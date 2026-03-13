
const {onDocumentUpdated, onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onObjectFinalized} = require("firebase-functions/v2/storage");
const {setGlobalOptions} = require("firebase-functions");
const admin = require("firebase-admin");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const path = require("path");
const os = require("os");
const fs = require("fs");

ffmpeg.setFfmpegPath(ffmpegPath);

if (!admin.apps.length) {
  admin.initializeApp();
}
setGlobalOptions({maxInstances: 10});

/**
 * 🎥 STARTUP-SAFE VIDEO COMPRESSION & THUMBNAIL ENGINE (Tier 1)
 * Automatically processes videos in 'videos/hot/'
 */
exports.compressVideo = onObjectFinalized({
  cpu: 2,
  memory: "2GiB",
  timeoutSeconds: 300,
}, async (event) => {
  const object = event.data;
  const bucket = admin.storage().bucket(object.bucket);
  const filePath = object.name;
  const contentType = object.contentType;

  // 1. Exit if not a video in the 'hot' tier or already processed
  if (!contentType || !contentType.startsWith("video/")) return null;
  if (!filePath.startsWith("videos/hot/")) return null;
  if (object.metadata && object.metadata.processed === "true") return null;

  const fileName = path.basename(filePath);
  const tempFilePath = path.join(os.tmpdir(), fileName);
  const targetFilePath = path.join(os.tmpdir(), `compressed-${fileName}`);
  const thumbFileName = `thumb-${fileName.split(".")[0]}.jpg`;
  const thumbTempPath = path.join(os.tmpdir(), thumbFileName);

  try {
    await bucket.file(filePath).download({destination: tempFilePath});

    // Transcode Video to 720p Optimized
    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .size("720x?") 
        .videoBitrate("800k") 
        .videoCodec("libx264")
        .format("mp4")
        .on("end", resolve)
        .on("error", reject)
        .save(targetFilePath);
    });

    // Capture 20KB Thumbnail
    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .screenshots({
          timestamps: ["1"],
          filename: thumbFileName,
          folder: os.tmpdir(),
          size: "320x?"
        })
        .on("end", resolve)
        .on("error", reject);
    });

    const thumbStoragePath = `videos/thumbs/${thumbFileName}`;
    
    await Promise.all([
      // Replace original with compressed
      bucket.upload(targetFilePath, {
        destination: filePath,
        metadata: {
          contentType: "video/mp4",
          metadata: { processed: "true", compressedAt: new Date().toISOString() },
        },
      }),
      // Upload to thumbs hub
      bucket.upload(thumbTempPath, {
        destination: thumbStoragePath,
        metadata: { contentType: "image/jpeg" },
      })
    ]);

    const db = admin.firestore();
    const publicBase = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/`;
    const originalUrlMatch = `${publicBase}${encodeURIComponent(filePath)}?alt=media`;
    const thumbUrl = `${publicBase}${encodeURIComponent(thumbStoragePath)}?alt=media`;

    const pulseSnap = await db.collection("campus_pulse").where("mediaUrl", "==", originalUrlMatch).get();
    const batch = db.batch();
    pulseSnap.forEach(doc => {
      batch.update(doc.ref, { imageUrl: thumbUrl, storageTier: 'hot', storagePath: filePath });
    });
    await batch.commit();

    [tempFilePath, targetFilePath, thumbTempPath].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    
  } catch (err) {
    console.error(`Media optimization failed for ${filePath}:`, err);
  }

  return null;
});

/**
 * ⛅ HYBRID STORAGE LIFECYCLE (Tier 2 & 3)
 * Runs daily to migrate cold videos to Nearline/Coldline or delete zombies.
 */
exports.manageVideoLifecycle = onSchedule("every 24 hours", async (event) => {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const now = new Date();
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  console.log("🧹 Starting Hybrid Storage Lifecycle sweep...");

  try {
    // A. ZOMBIE CLEANUP (Rule: Old + No Engagement)
    const zombieSnap = await db.collection("campus_pulse")
      .where("mediaType", "==", "video")
      .where("likes", "==", 0)
      .where("createdAt", "<", thirtyDaysAgo.toISOString())
      .get();

    for (const doc of zombieSnap.docs) {
      const data = doc.data();
      if (data.mediaUrl && data.mediaUrl.includes(bucket.name)) {
        const filePath = decodeURIComponent(data.mediaUrl.split("/o/")[1].split("?")[0]);
        await bucket.file(filePath).delete().catch(() => null);
      }
      await doc.ref.delete();
    }

    // B. TIER 3: COLD MIGRATION (Rule: Very Old + Low Engagement -> Cold Storage)
    const coldSnap = await db.collection("campus_pulse")
      .where("mediaType", "==", "video")
      .where("likes", "<", 50)
      .where("createdAt", "<", ninetyDaysAgo.toISOString())
      .get();

    for (const doc of coldSnap.docs) {
      const data = doc.data();
      if (data.storageTier === 'cold') continue; // Already cold

      if (data.mediaUrl && data.mediaUrl.includes(bucket.name)) {
        const oldPath = decodeURIComponent(data.mediaUrl.split("/o/")[1].split("?")[0]);
        const newPath = oldPath.replace("videos/hot/", "videos/cold/").replace("videos/warm/", "videos/cold/");
        
        if (oldPath !== newPath) {
            // Physical Move
            await bucket.file(oldPath).move(newPath);
            // Storage Class Stamp (Rule 3)
            await bucket.file(newPath).setStorageClass("COLDLINE");

            // Atomic URL Update in Firestore
            const newUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(newPath)}?alt=media`;
            await doc.ref.update({ 
              mediaUrl: newUrl, 
              storageTier: 'cold',
              storagePath: newPath 
            });
        }
      }
    }

    // C. TIER 2: WARM MIGRATION (Rule: Old + Low Engagement -> Warm Storage)
    const warmSnap = await db.collection("campus_pulse")
      .where("mediaType", "==", "video")
      .where("likes", "<", 10)
      .where("createdAt", "<", thirtyDaysAgo.toISOString())
      .get();

    for (const doc of warmSnap.docs) {
      const data = doc.data();
      if (data.storageTier === 'warm' || data.storageTier === 'cold') continue;

      if (data.mediaUrl && data.mediaUrl.includes("videos/hot/")) {
        const oldPath = decodeURIComponent(data.mediaUrl.split("/o/")[1].split("?")[0]);
        const newPath = oldPath.replace("videos/hot/", "videos/warm/");
        
        if (oldPath !== newPath) {
            // Physical Move
            await bucket.file(oldPath).move(newPath);
            // Storage Class Stamp (Rule 2)
            await bucket.file(newPath).setStorageClass("NEARLINE");

            // Atomic URL Update in Firestore
            const newUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(newPath)}?alt=media`;
            await doc.ref.update({ 
              mediaUrl: newUrl, 
              storageTier: 'warm',
              storagePath: newPath
            });
        }
      }
    }

    console.log(`✅ Lifecycle complete. Pruned ${zombieSnap.size}, Coldified ${coldSnap.size}, Warmed ${warmSnap.size}.`);
  } catch (err) {
    console.error("❌ Lifecycle Error:", err);
  }
});

/**
 * 🛰️ LIAISON NOTIFICATION SERVICE: Throttling & Delivery
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

    if (lastSent) {
      const diffHours = (now - lastSent) / 3600000;
      if (diffHours < 2) return null;
      const isSameDay = lastSent.toDateString() === now.toDateString();
      if (isSameDay && (prefs.dailyCount || 0) >= 3) return null;
      if (!isSameDay) prefs.dailyCount = 0;
    }

    await admin.messaging().send({
      token: token,
      notification: payload.notification,
      data: payload.data || {}
    });

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

async function sendSmartMulticast(recipients, payload, db) {
  if (!recipients || recipients.length === 0) return null;
  const deliveryPromises = recipients.map(uid => checkThrottlingAndNotify(uid, payload, db));
  return Promise.all(deliveryPromises);
}

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
    const profilesSnap = await db.collection("user_intelligence")
      .where("favoriteProducts", "array-contains", productId)
      .get();
    profilesSnap.docs.forEach(doc => interestedUserIds.add(doc.id));

    const viewThreshold = new Date();
    viewThreshold.setDate(viewThreshold.setDate() - 30);
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

exports.aggregateGlobalTrends = onSchedule("every 5 minutes", async (event) => {
  const db = admin.firestore();
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const since = admin.firestore.Timestamp.fromMillis(oneHourAgo);

  try {
    const snapshot = await db.collection("trend_events")
      .where("timestamp", ">", since)
      .get();

    const scores = {
      _updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    snapshot.forEach(doc => {
      const e = doc.data();
      if (e.entityId) scores[e.entityId] = (scores[e.entityId] || 0) + 1;
      if (e.tag) {
        const normalizedTag = e.tag.toLowerCase();
        scores[normalizedTag] = (scores[normalizedTag] || 0) + 1;
      }
    });

    await db.collection("trend_scores").doc("current").set(scores);
    console.log(`✅ Trend Aggregation Complete: Processed ${snapshot.size} events.`);
  } catch (err) {
    console.error("❌ Trend Aggregation Error:", err);
  }
});

exports.onProductCreatedNotify = onDocumentCreated("products/{productId}", async (event) => {
  const product = event.data.data();
  const vendorId = product.vendorId;
  const db = admin.firestore();

  try {
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

exports.onDemandSignalUpdatedNotify = onDocumentUpdated("demand_signals/{signalId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const db = admin.firestore();

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
    console.error("Liaison Leaderboard Error:", err);
    return null;
  }
});

exports.sendDailyRecommendations = onSchedule("0 8 * * *", async (event) => {
  const db = admin.firestore();
  try {
    const usersSnap = await db.collection("users").where("fcmToken", "!=", null).limit(500).get();
    if (usersSnap.empty) return null;
    for (const uDoc of usersSnap.docs) {
      const userId = uDoc.id;
      const userData = uDoc.data();
      const profileSnap = await db.collection("user_intelligence").doc(userId).get();
      if (!profileSnap.exists) continue;
      const profile = profileSnap.data();
      const interests = profile.interests || {};
      let topCategory = null;
      let maxViews = 0;
      Object.entries(interests).forEach(([cat, score]) => {
        if (score > maxViews) { maxViews = score; topCategory = cat; }
      });
      if (!topCategory) continue;
      const productsSnap = await db.collection("products")
        .where("campusId", "==", userData.campusId)
        .where("category", "==", topCategory.charAt(0).toUpperCase() + topCategory.slice(1))
        .orderBy("trendScore", "desc")
        .limit(1)
        .get();
      if (productsSnap.empty) continue;
      const topPick = productsSnap.docs[0].data();
      await checkThrottlingAndNotify(userId, {
        notification: {
          title: "🧠 Morning Pick for You",
          body: `Since you love ${topCategory}, you'll love ${topPick.name}!`
        },
        data: { productId: topPick.id, type: "daily_recommendation" }
      }, db);
    }
    return null;
  } catch (err) {
    console.error("Daily Recommendations Error:", err);
    return null;
  }
});
