
const {onDocumentUpdated, onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {setGlobalOptions} = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({maxInstances: 10});

/**
 * 🛰️ LIAISON NOTIFICATION SERVICE: Throttling & Delivery with Analytics
 * Rule: Max 3 notifications per day, min 2 hours between.
 */
async function checkThrottlingAndNotify(userId, payload, db) {
  const prefRef = db.collection("user_notifications").doc(userId);
  const userRef = db.collection("users").doc(userId);
  
  try {
    const [prefSnap, userSnap] = await Promise.all([prefRef.get(), userRef.get()]);
    if (!userSnap.exists) return null;
    
    const userData = userSnap.data();
    const token = userData.fcmToken;
    if (!token) return null;

    const prefs = prefSnap.exists ? prefSnap.data() : { priceDrops: true, dailyCount: 0 };
    const now = new Date();
    const lastSent = prefs.lastSentAt ? new Date(prefs.lastSentAt) : null;

    // 1. Throttling Checks
    if (lastSent) {
      const diffHours = (now - lastSent) / 3600000;
      if (diffHours < 2) return null;

      const isSameDay = lastSent.toDateString() === now.toDateString();
      if (isSameDay && (prefs.dailyCount || 0) >= 3) return null;
      
      if (!isSameDay) {
        prefs.dailyCount = 0;
      }
    }

    // 2. Deliver via FCM
    await admin.messaging().send({
      token: token,
      notification: payload.notification,
      data: payload.data || {}
    });

    // 3. Update Audit Trail & Throttling Stats
    const batch = db.batch();
    batch.set(prefRef, {
      lastSentAt: now.toISOString(),
      dailyCount: (prefs.dailyCount || 0) + 1
    }, { merge: true });

    batch.add(db.collection("notifications"), {
      userId,
      title: payload.notification.title,
      body: payload.notification.body,
      type: payload.data?.type || "system",
      sentAt: now.toISOString(),
      opened: false,
      clicked: false,
      purchased: false,
      relatedProductId: payload.data?.productId || null
    });

    return batch.commit();

  } catch (err) {
    console.error(`Liaison Delivery Service Error for ${userId}:`, err);
    return null;
  }
}

/**
 * 🛰️ LIAISON NOTIFICATION SERVICE: Helper to send multicast messages
 */
async function sendSmartMulticast(recipients, payload, db) {
  if (!recipients || recipients.length === 0) return null;
  const deliveryPromises = recipients.map(uid => checkThrottlingAndNotify(uid, payload, db));
  return Promise.all(deliveryPromises);
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
  const isSignificantDrop = after.averagePrice && (after.price < after.averagePrice * 0.80); 
  const isRestock = after.stock > 0 && before.stock === 0;

  if (!isPriceDrop && !isSignificantDrop && !isRestock) return null;

  try {
    const interestedUserIds = new Set();
    const profilesSnap = await db.collection("user_market_profiles")
      .where("favoriteProducts", "array-contains", productId)
      .get();
    profilesSnap.docs.forEach(doc => interestedUserIds.add(doc.id));

    const viewThreshold = new Date();
    viewThreshold.setDate(viewThreshold.getDate() - 30);
    const viewsSnap = await db.collection("user_product_views")
      .where("productId", "==", productId)
      .where("viewedAt", ">=", viewThreshold.toISOString())
      .limit(100)
      .get();
    viewsSnap.forEach(vDoc => interestedUserIds.add(vDoc.data().userId));

    if (interestedUserIds.size === 0) return null;

    let title = "";
    let body = "";

    if (isPriceDrop || isSignificantDrop) {
      title = isSignificantDrop ? "📉 MASSIVE DEAL ALERT!" : "📉 Price Drop Alert!";
      body = `${after.name} is now only GHS ${after.price}! 💸`;
    } else if (isRestock) {
      title = "📦 Fresh Stock in the Yard!";
      body = `Good news! ${after.name} is back. Get it while it lasts!`;
    }

    return sendSmartMulticast(Array.from(interestedUserIds), {
      notification: { title, body },
      data: { productId, type: isPriceDrop ? "price_drop" : "restock" }
    }, db);

  } catch (err) {
    console.error(`Liaison Price Engine Error for ${productId}:`, err);
    return null;
  }
});

/**
 * 🔔 SMART NOTIFICATION ENGINE: Vendor New Post Alert & Request Matching
 */
exports.onProductCreatedNotify = onDocumentCreated("products/{productId}", async (event) => {
  const product = event.data.data();
  const vendorId = product.vendorId;
  const db = admin.firestore();

  try {
    // 1. Follower Notification
    const followersSnap = await db.collection("users")
      .where("followedVendors", "array-contains", vendorId)
      .get();

    const uids = followersSnap.docs.map(doc => doc.id);
    if (uids.length > 0) {
        await sendSmartMulticast(uids, {
            notification: {
                title: "📦 New Arrival!",
                body: `${product.vendorName} just listed a new vibe: ${product.name}`
            },
            data: { productId: event.params.productId, type: "vendor_new_post" }
        }, db);
    }

    // 🤝 2. Request Matching: Find students looking for this category
    const requestsSnap = await db.collection("market_requests")
      .where("campusId", "==", product.campusId)
      .where("category", "==", product.category.toLowerCase())
      .where("status", "==", "open")
      .get();

    if (!requestsSnap.empty) {
        const requestingUserIds = requestsSnap.docs.map(doc => doc.data().userId);
        await sendSmartMulticast(requestingUserIds, {
            notification: {
                title: "📦 Item Available!",
                body: `Good news! ${product.name} just arrived in the Yard. You recently requested this!`
            },
            data: { productId: event.params.productId, type: "request_match" }
        }, db);
    }

    return null;

  } catch (err) {
    console.error("Product Creation Intelligence Error:", err);
    return null;
  }
});

/**
 * 🔔 SMART NOTIFICATION ENGINE: Demand Spike Detector
 * Threshold: At least 5 students looking for the same item on a campus.
 */
exports.onDemandSignalUpdatedNotify = onDocumentUpdated("demand_signals/{signalId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const db = admin.firestore();

  // Condition: Crosses the "5 Request" threshold
  if (after.demandCount >= 5 && (before.demandCount || 0) < 5) {
    try {
      const vendorsSnap = await db.collection("users")
        .where("role", "==", "vendor")
        .where("campusId", "==", after.campusId)
        .where("vendorCategory", "==", after.category || 'General')
        .get();

      if (vendorsSnap.empty) return null;
      const uids = vendorsSnap.docs.map(doc => doc.id);

      return sendSmartMulticast(uids, {
        notification: {
          title: "📈 Student Demand Rising!",
          body: `Students are looking for: ${after.item.toUpperCase()}. High sourcing priority!`
        },
        data: { item: after.item, type: "demand_spike" }
      }, db);

    } catch (err) {
      console.error("Demand Spike Alert Error:", err);
      return null;
    }
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
 * 🧠 SMART TIMING: DAILY RECOMMENDATIONS SCHEDULER
 */
exports.sendDailyRecommendations = onSchedule("0 8 * * *", async (event) => {
  const db = admin.firestore();
  try {
    const usersSnap = await db.collection("users").where("fcmToken", "!=", null).limit(500).get();
    if (usersSnap.empty) return null;

    for (const uDoc of usersSnap.docs) {
      const userId = uDoc.id;
      const userData = uDoc.data();
      const profileSnap = await db.collection("user_market_profiles").doc(userId).get();
      if (!profileSnap.exists) continue;
      
      const profile = profileSnap.data();
      const viewedCategories = profile.viewedCategories || {};
      let topCategory = null;
      let maxViews = 0;
      Object.entries(viewedCategories).forEach(([cat, count]) => {
        if (count > maxViews) { maxViews = count; topCategory = cat; }
      });

      if (!topCategory) continue;

      const productsSnap = await db.collection("products")
        .where("campusId", "==", userData.campusId)
        .where("category", "==", topCategory)
        .orderBy("trendScore", "desc")
        .limit(1)
        .get();

      if (productsSnap.empty) continue;
      const topPick = productsSnap.docs[0].data();

      await checkThrottlingAndNotify(userId, {
        notification: {
          title: "🧠 Morning Pick for You",
          body: `Since you like ${topCategory}, you'll love ${topPick.name}!`
        },
        data: { productId: topPick.id, type: "daily_recommendation" }
      }, db);
    }
    return null;
  } catch (err) {
    console.error("Daily Recommendations Engine Error:", err);
    return null;
  }
});
