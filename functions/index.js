
const {onDocumentUpdated, onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {setGlobalOptions} = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({maxInstances: 10});

/**
 * 🛰️ LIAISON NOTIFICATION SERVICE: Helper to send multicast messages
 * Respects user tokens and handles batching.
 */
async function sendMulticastNotification(tokens, payload) {
  if (!tokens || tokens.length === 0) return null;
  
  // FCM Multicast limit is 500 per call
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  const results = await Promise.all(chunks.map(chunk => {
    const message = {
      ...payload,
      tokens: chunk
    };
    return admin.messaging().sendEachForMulticast(message);
  }));

  return results;
}

/**
 * 🔔 SMART NOTIFICATION ENGINE: Price Drop & Restock Detector
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

    // 3. Filter by Preferences (Price Drops)
    const tokens = [];
    const now = new Date();
    const hour = now.getHours();

    // Batch fetch user data and preferences
    const usersSnap = await db.collection("users")
      .where("__name__", "in", interestedUserIds.slice(0, 100))
      .get();

    for (const uDoc of usersSnap.docs) {
      const userData = uDoc.data();
      const prefSnap = await db.collection("user_notifications").doc(uDoc.id).get();
      const prefs = prefSnap.exists() ? prefSnap.data() : { priceDrops: true, quietHours: { start: 22, end: 7 } };

      // Check Preference & Quiet Hours
      if (!prefs.priceDrops) continue;
      if (prefs.quietHours) {
        const { start, end } = prefs.quietHours;
        if (start > end) { // Wraps around midnight
          if (hour >= start || hour < end) continue;
        } else {
          if (hour >= start && hour < end) continue;
        }
      }

      if (userData.fcmToken && userData.id !== after.vendorId) {
        tokens.push(userData.fcmToken);
      }
    }

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

    return sendMulticastNotification(tokens, {
      notification: { title, body },
      data: { productId, type: isPriceDrop ? "price_drop" : "restock" }
    });

  } catch (err) {
    console.error(`Liaison Notification Engine Error for ${productId}:`, err);
    return null;
  }
});

/**
 * 🔔 SMART NOTIFICATION ENGINE: Vendor New Post Alert
 */
exports.onProductCreatedNotify = onDocumentCreated("products/{productId}", async (event) => {
  const product = event.data.data();
  const vendorId = product.vendorId;
  const db = admin.firestore();

  try {
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

    return sendMulticastNotification(tokens, {
      notification: {
        title: "📦 New Arrival!",
        body: `${product.vendorName} just listed a new vibe: ${product.name}`
      },
      data: { productId: event.params.productId, type: "vendor_new_post" }
    });

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
 * 🛒 PRODUCT TRENDING ENGINE (V2) - Reactive Sync & Notification Trigger
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
    
    if (!productSnap.exists()) return null;
    const product = productSnap.data();

    // 🏎️ Update the trendScore on the main product document for ranking
    const currentScore = product.trendScore || 0;
    if (Math.abs(currentScore - finalTrendScore) > 0.1) {
      await productRef.update({ trendScore: finalTrendScore, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    // 🔥 TRENDING NOTIFICATION TRIGGER (Threshold: 50 points)
    if (finalTrendScore >= 50 && currentScore < 50) {
      // Find users interested in this category
      const interestedProfilesSnap = await db.collection("user_market_profiles")
        .where(`viewedCategories.${product.category}`, ">", 5)
        .limit(100)
        .get();

      const userIds = interestedProfilesSnap.docs.map(doc => doc.id);
      if (userIds.length === 0) return null;

      const usersSnap = await db.collection("users")
        .where("__name__", "in", userIds)
        .get();

      const tokens = [];
      for (const uDoc of usersSnap.docs) {
        const userData = uDoc.data();
        const prefSnap = await db.collection("user_notifications").doc(uDoc.id).get();
        const prefs = prefSnap.exists() ? prefSnap.data() : { trendingProducts: true };

        if (prefs.trendingProducts && userData.fcmToken) {
          tokens.push(userData.fcmToken);
        }
      }

      if (tokens.length > 0) {
        return sendMulticastNotification(tokens, {
          notification: {
            title: "🔥 Trending on Campus",
            body: `${product.name} is the new vibe! Check what everyone is buying.`
          },
          data: { productId, type: "trending_alert" }
        });
      }
    }

    return null;
  } catch (err) {
    console.error(`Liaison Trending Error for ${productId}:`, err);
    return null;
  }
});
