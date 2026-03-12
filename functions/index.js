
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentUpdated, onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onObjectFinalized} = require("firebase-functions/v2/storage");
const {onRequest, onCall, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions");
const admin = require("firebase-admin");
const {getStorage} = require("firebase-admin/storage");
const {beforeUserCreated, beforeUserSignedIn} = require("firebase-functions/v2/identity");
const crypto = require("crypto");

admin.initializeApp();
setGlobalOptions({maxInstances: 10});

/**
 * 🏎️ REAL-TIME TRENDING ENGINE (REACTIVE)
 * Upgraded with Exponential Trend Decay (6-hour Half-Life).
 */
exports.calculateTrendingScore = onDocumentUpdated("trending_stats/{postId}", async (event) => {
  const data = event.data.after.data();
  const oldData = event.data.before.data();
  const db = admin.firestore();
  const postId = event.params.postId;

  // Optimization: Only run if engagement data has actually changed
  const hasEngagementChanged = ["views", "likes", "comments", "shares", "completions"].some((k) => data[k] !== oldData[k]);
  if (!hasEngagementChanged) return null;

  try {
    // 1. COMPUTE VELOCITY (Last 15 Minutes)
    const now = new Date();
    const lookbackMins = 15;
    const startTime = new Date(now.getTime() - lookbackMins * 60000).toISOString().slice(0, 16);
    
    const velocitySnap = await db.collection("post_velocity").doc(postId).collection("minutes")
      .where("__name__", ">=", startTime)
      .get();

    let recentEngagement = 0;
    velocitySnap.forEach((doc) => {
      const v = doc.data();
      recentEngagement += (v.views || 0) + (v.likes || 0) * 3 + (v.comments || 0) * 5 + (v.shares || 0) * 8;
    });

    const velocity = recentEngagement / lookbackMins;

    // 2. COMPUTE RATES (Normalized)
    const totalViews = Math.max(data.views || 1, 1);
    const engagementRate = ((data.likes || 0) + (data.comments || 0) + (data.shares || 0)) / totalViews;
    const completionRate = (data.completions || 0) / totalViews;

    // 3. APPLY MASTER TREND FORMULA
    let score = (velocity * 0.5) + (engagementRate * 30) + (completionRate * 20);

    // 📉 TREND DECAY SYSTEM: Aggressive 6-hour Half-Life
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
    const ageHours = (new Date() - createdAt) / 3600000;
    const halfLife = 6; 
    const decay = Math.exp(-ageHours / halfLife); 
    score *= decay;

    // 🚀 Super-Viral Boost for fresh content
    if (data.views > 1000 && ageHours < 1) score *= 1.5;

    // 4. VIRAL GRADUATION
    if (score > 40) {
      await db.collection("viral_posts").doc(postId).set({
        postId,
        trendScore: score,
        detectedAt: admin.firestore.FieldValue.serverTimestamp(),
        authorId: data.authorId || null,
        campusId: data.campusId || "all"
      }, { merge: true });
    }

    if (data.trendScore && Math.abs(data.trendScore - score) < 0.01) return null;

    return event.data.after.ref.update({ 
      trendScore: score, 
      velocity: velocity,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    });

  } catch (err) {
    console.error(`Trending Engine Failure for post ${postId}:`, err);
    return null;
  }
});

/**
 * 🛒 PRODUCT TRENDING ENGINE
 * Monitors commercial velocity to surface hot campus items.
 */
exports.calculateProductTrendingScore = onDocumentUpdated("products/{productId}", async (event) => {
  const data = event.data.after.data();
  const oldData = event.data.before.data();
  const db = admin.firestore();
  const productId = event.params.productId;

  // Optimization: Only run if counts changed
  const hasChanged = data.viewCount !== oldData.viewCount || data.salesCount !== oldData.salesCount;
  if (!hasChanged) return null;

  try {
    const now = new Date();
    const lookbackMins = 15;
    const startTime = new Date(now.getTime() - lookbackMins * 60000).toISOString().slice(0, 16);
    
    const velocitySnap = await db.collection("product_velocity").doc(productId).collection("minutes")
      .where("__name__", ">=", startTime)
      .get();

    let recentVelocity = 0;
    let recentSales = 0;
    velocitySnap.forEach((doc) => {
      const v = doc.data();
      recentVelocity += (v.views || 0) + (v.intents || 0) * 5;
      recentSales += (v.purchases || 0);
    });

    // Score combines view velocity and immediate sales momentum
    const velocity = recentVelocity / lookbackMins;
    const score = (velocity * 2.0) + (recentSales * 10.0);

    if (data.trendScore && Math.abs(data.trendScore - score) < 0.01) return null;

    return event.data.after.ref.update({ 
      trendScore: score,
      recentSales: recentSales,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    });
  } catch (err) {
    console.error(`Product Trending Failure for ${productId}:`, err);
    return null;
  }
});

/**
 * 🕒 SCHEDULED TREND DECAY AUDITOR
 * Ensures that even inactive posts are decayed so the Pulse stays fresh.
 */
exports.applyGlobalTrendDecay = onSchedule("every 1 hour", async (event) => {
  const db = admin.firestore();
  const now = new Date();
  const halfLife = 6;

  // Only audit active trends from the last 48 hours to save ops
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  
  const activeTrendsSnap = await db.collection("trending_stats")
    .where("updatedAt", ">=", fortyEightHoursAgo)
    .get();

  if (activeTrendsSnap.empty) return null;

  const batch = db.batch();
  activeTrendsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : now;
    const ageHours = (now - createdAt) / 3600000;
    
    // Recalculate decay based on current time
    const decay = Math.exp(-ageHours / halfLife);
    
    // Base score (without previous decay) is estimated from raw stats
    const totalViews = Math.max(data.views || 1, 1);
    const engagementRate = ((data.likes || 0) + (data.comments || 0) + (data.shares || 0)) / totalViews;
    const completionRate = (data.completions || 0) / totalViews;
    
    let baseScore = (engagementRate * 30) + (completionRate * 20);
    let newScore = baseScore * decay;

    batch.update(docSnap.ref, { 
      trendScore: newScore,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  return batch.commit();
});

/**
 * 🏆 CREATOR REPUTATION & TIER ENGINE
 */
exports.calculateCreatorReputation = onDocumentUpdated("trending_stats/{postId}", async (event) => {
  const data = event.data.after.data();
  const authorId = data.authorId;
  if (!authorId) return null;

  const db = admin.firestore();
  
  const totalEngagement = (data.views || 0) + (data.likes || 0) + (data.comments || 0);
  if (totalEngagement % 5 !== 0) return null;

  const postsSnap = await db.collection("trending_stats").where("authorId", "==", authorId).get();
  if (postsSnap.empty) return null;

  let totalViews = 0;
  let totalInteractions = 0;
  let totalCompletions = 0;
  const count = postsSnap.size;

  postsSnap.forEach((d) => {
    const p = d.data();
    totalViews += (p.views || 0);
    totalInteractions += (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
    totalCompletions += (p.completions || 0);
  });

  const divisor = Math.max(totalViews, 1);
  const engagementRate = totalInteractions / divisor;
  const completionRate = totalCompletions / divisor;

  const consistencyBonus = count > 5 ? 10 : 0;
  const violationPenalty = (data.violations || 0) * 20;

  let qualityScore = (engagementRate * 200) + (completionRate * 100) + consistencyBonus - violationPenalty;
  qualityScore = Math.min(100, Math.max(0, Math.round(qualityScore)));

  let tier = "new";
  if (qualityScore >= 80) tier = "elite";
  else if (qualityScore >= 50) tier = "trusted";
  else if (qualityScore >= 20) tier = "rising";

  const reputation = {
    id: authorId,
    qualityScore,
    tier,
    engagementRate,
    completionRate,
    postCount: count,
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await db.collection("creator_reputation").doc(authorId).set(reputation, { merge: true });
  return db.collection("users").doc(authorId).set({ qualityScore, creatorTier: tier }, { merge: true });
});

/**
 * #️⃣ HASHTAG INDEXER & VELOCITY TRACKER
 */
exports.onVibeCreatedUpdateHashtags = onDocumentCreated("campus_pulse/{postId}", async (event) => {
  const data = event.data.data();
  const tags = data.tags || [];
  const db = admin.firestore();
  const batch = db.batch();

  const statsRef = db.collection("trending_stats").doc(event.params.postId);
  batch.set(statsRef, {
    authorId: data.authorId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    views: 0, likes: 0, comments: 0, shares: 0, completions: 0,
    trendScore: 0
  }, { merge: true });

  if (tags.length > 0) {
    const minuteBucket = new Date().toISOString().slice(0, 16);
    tags.forEach((tag) => {
      const normalizedTag = tag.toLowerCase();
      const tagRef = db.collection("hashtags").doc(normalizedTag);
      batch.set(tagRef, {
        tag: normalizedTag,
        postCount: admin.firestore.FieldValue.increment(1),
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const statsRef = db.collection("hashtagStats").doc(normalizedTag).collection("minutes").doc(minuteBucket);
      batch.set(statsRef, { count: admin.firestore.FieldValue.increment(1) }, { merge: true });
    });
  }

  await batch.commit();
});

/**
 * 📈 TRENDING HASHTAG UPDATER
 */
exports.updateTrendingHashtags = onSchedule("every 5 minutes", async (event) => {
  const db = admin.firestore();
  const hashtagsSnapshot = await db.collection("hashtags").get();
  const now = new Date();
  const batch = db.batch();
  const lookbackMins = 30;
  const startTime = new Date(now.getTime() - lookbackMins * 60000).toISOString().slice(0, 16);
  const trendingPool = [];

  const processPromises = hashtagsSnapshot.docs.map(async (docSnap) => {
    const tag = docSnap.id;
    const data = docSnap.data();
    const statsSnap = await db.collection("hashtagStats").doc(tag).collection("minutes").where("__name__", ">=", startTime).get();
    const totalNewPosts = statsSnap.docs.reduce((acc, d) => acc + (d.data().count || 0), 0);
    const velocity = totalNewPosts / lookbackMins;
    
    const lastUsedAt = data.lastUsedAt?.toDate ? data.lastUsedAt.toDate() : now;
    const ageHours = Math.max(0, (now - lastUsedAt) / 3600000);
    
    const decay = Math.exp(-ageHours / 12);
    const trendScore = (velocity * 0.6 + (velocity > 0 ? 0.3 : 0) + (1 / (ageHours * 60 + 1)) * 0.1) * decay;

    batch.update(docSnap.ref, { trendScore, velocity, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    
    if (trendScore > 15) trendingPool.push({ tag, score: trendScore, ref: docSnap.ref });
    if (trendScore > 30) batch.set(db.collection("viral_hashtags").doc(tag), { tag, trendScore, detectedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });

  await Promise.all(processPromises);
  const clusterBatch = db.batch();
  if (trendingPool.length >= 2) {
    const sorted = trendingPool.sort((a, b) => b.score - a.score).slice(0, 15);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const tagA = sorted[i].tag; const tagB = sorted[j].tag;
        const edgeSnap = await db.collection("hashtagGraph").doc(tagA).collection("edges").doc(tagB).get();
        if (edgeSnap.exists() && edgeSnap.data().weight > 20) {
          const eventId = `EVENT_${[tagA, tagB].sort().join("_")}`;
          clusterBatch.set(db.collection("trend_events").doc(eventId), { tags: [tagA, tagB], collectiveVelocity: sorted[i].score + sorted[j].score, detectedAt: admin.firestore.FieldValue.serverTimestamp(), status: "active" }, { merge: true });
          clusterBatch.update(sorted[i].ref, { activeEventId: eventId });
          clusterBatch.update(sorted[j].ref, { activeEventId: eventId });
        }
      }
    }
  }
  await batch.commit(); await clusterBatch.commit();
});

/**
 * 🤖 AI MEDIA CONTENT AUDIT (STORAGE TRIGGER)
 */
exports.onVibeMediaUploaded = onObjectFinalized(async (event) => {
  const filePath = event.data.name;
  if (!filePath.startsWith("social_posts/") && !filePath.startsWith("social_videos/")) return;

  const db = admin.firestore();
  const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${event.data.bucket}/o/${encodeURIComponent(filePath)}?alt=media`;
  
  const postsSnap = await db.collection("campus_pulse").where("mediaUrl", "==", fileUrl).limit(1).get();
  if (!postsSnap.empty) {
    return postsSnap.docs[0].ref.update({ mediaStatus: "ready", auditedAt: admin.firestore.FieldValue.serverTimestamp() });
  }
});
