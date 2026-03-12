
const {onDocumentUpdated, onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {setGlobalOptions} = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({maxInstances: 10});

/**
 * 🔔 SMART NOTIFICATION ENGINE: Price Drop & Restock Detector
 * Triggers when a product document is updated.
 * 
 * Logic:
 * 1. Detect if price dropped below previous or historical average (20% threshold).
 * 2. Find users who viewed this product recently (user_product_views).
 * 3. Find users who favorited this product (user_market_profiles).
 * 4. Multicast notification to all interested parties.
 */
exports.onProductUpdatedNotify = onDocumentUpdated("products/{productId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const productId = event.params.productId;
  const db = admin.firestore();

  const isPriceDrop = after.price < before.price;
  const isSignificantDrop = after.averagePrice && (after.price < after.averagePrice * 0.80); // 20% or more OFF
  const isRestock = after.stock > 0 && before.stock === 0;

  if (!isPriceDrop && !isSignificantDrop && !isRestock) return null;

  try {
    // 1. Gather Users from Explicit Favorites
    const profilesSnap = await db.collection("user_market_profiles")
      .where("favoriteProducts", "array-contains", productId)
      .get();
    
    let interestedUserIds = profilesSnap.docs.map(doc => doc.id);

    // 2. Gather Users from Recent Views (Last 30 days)
    const viewThreshold = new Date();
    viewThreshold.setDate(viewThreshold.getDate() - 30);
    
    const viewsSnap = await db.collection("user_product_views")
      .where("productId", "==", productId)
      .where("viewedAt", ">=", viewThreshold.toISOString())
      .limit(200)
      .get();

    viewsSnap.forEach(vDoc => {
        const uid = vDoc.data().userId;
        if (!interestedUserIds.includes(uid)) interestedUserIds.push(uid);
    });

    if (interestedUserIds.length === 0) return null;

    // 3. Batch Fetch de-duplicated tokens
    const usersSnap = await db.collection("users")
      .where("__name__", "in", interestedUserIds.slice(0, 100)) // FCM batch limit
      .get();

    const tokens = [];
    usersSnap.forEach(uDoc => {
      const data = uDoc.data();
      const token = data.fcmToken;
      // Safety: Don't notify the vendor themselves
      if (token && data.id !== after.vendorId) tokens.push(token);
    });

    if (tokens.length === 0) return null;

    let title = "";
    let body = "";

    if (isPriceDrop || isSignificantDrop) {
      title = isSignificantDrop ? "📉 MASSIVE DEAL ALERT!" : "📉 Price Drop Alert!";
      body = `${after.name} is now only GHS ${after.price}! 💸`;
    } else if (isRestock) {
      title = "📦 Fresh Stock in the Yard!";
      body = `Good news! ${after.name} is back. Get it while it lasts!`;
    }

    const message = {
      notification: { title, body },
      data: { productId, type: isPriceDrop ? "price_drop" : "restock" },
      tokens: tokens
    };

    return admin.messaging().sendEachForMulticast(message);

  } catch (err) {
    console.error(`Liaison Notification Engine Error for ${productId}:`, err);
    return null;
  }
});

/**
 * 🔔 SMART NOTIFICATION ENGINE: Vendor New Post Alert
 * Triggers when a new product is listed.
 */
exports.onProductCreatedNotify = onDocumentCreated("products/{productId}", async (event) => {
  const product = event.data.data();
  const vendorId = product.vendorId;
  const db = admin.firestore();

  try {
    // Find users who follow this vendor
    const followersSnap = await db.collection("users")
      .where("followedVendors", "array-contains", vendorId)
      .get();

    if (followersSnap.empty) return null;

    const tokens = [];
    followersSnap.forEach(doc => {
      const token = doc.data().fcmToken;
      if (token) tokens.push(token);
    });

    if (tokens.length === 0) return null;

    const message = {
      notification: {
        title: "📦 New Arrival!",
        body: `${product.vendorName} just listed a new vibe: ${product.name}`
      },
      data: { productId: event.params.productId, type: "vendor_new_post" },
      tokens: tokens
    };

    return admin.messaging().sendEachForMulticast(message);

  } catch (err) {
    console.error("Vendor Update Notification Error:", err);
    return null;
  }
});

/**
 * 🛒 PRODUCT TRENDING LEADERBOARD SCHEDULER
 */
exports.updateTrendingLeaderboard = onSchedule("every 10 minutes", async (event) => {
  const db = admin.firestore();
  const now = new Date();

  try {
    const trendsSnap = await db.collection("product_trends").get();
    if (trendsSnap.empty) return null;

    const scoredProducts = [];
    trendsSnap.forEach((doc) => {
      const data = doc.data();
      const rawScore = (data.viewCount || 0) * 1 + (data.cartCount || 0) * 4 + (data.purchaseCount || 0) * 8 + (data.shareCount || 0) * 3;
      const lastUpdated = data.lastUpdated?.toDate ? data.lastUpdated.toDate() : now;
      const hoursSinceUpdate = (now - lastUpdated) / 3600000;
      const decayFactor = Math.exp(-hoursSinceUpdate / 24);
      const finalScore = rawScore * decayFactor;
      if (finalScore > 0) scoredProducts.push({ productId: doc.id, score: finalScore });
    });

    const topProducts = scoredProducts.sort((a, b) => b.score - a.score).slice(0, 20).map(p => p.productId);

    return db.collection("market_leaderboard").doc("trending").set({
      productIds: topProducts,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      type: "global_trending"
    });
  } catch (err) {
    console.error("Liaison Leaderboard Re-compute Error:", err);
    return null;
  }
});

/**
 * 🛒 PRODUCT TRENDING ENGINE (V2) - Reactive Sync
 */
exports.calculateProductTrendingScore = onDocumentUpdated("product_trends/{productId}", async (event) => {
  const data = event.data.after.data();
  const db = admin.firestore();
  const productId = event.params.productId;
  try {
    const rawScore = (data.viewCount || 0) * 1 + (data.cartCount || 0) * 4 + (data.purchaseCount || 0) * 8 + (data.shareCount || 0) * 3;
    const now = new Date();
    const lastUpdated = data.lastUpdated?.toDate ? data.lastUpdated.toDate() : now;
    const hoursSinceUpdate = (now - lastUpdated) / 3600000;
    const decayFactor = Math.exp(-hoursSinceUpdate / 24);
    const finalTrendScore = rawScore * decayFactor;
    const productRef = db.collection("products").doc(productId);
    const productSnap = await productRef.get();
    if (productSnap.exists()) {
      const currentScore = productSnap.data().trendScore || 0;
      if (Math.abs(currentScore - finalTrendScore) > 0.1) {
        return productRef.update({ trendScore: finalTrendScore, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
    return null;
  } catch (err) {
    console.error(`Liaison Trending Error for ${productId}:`, err);
    return null;
  }
});
