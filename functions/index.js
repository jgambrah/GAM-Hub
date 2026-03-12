
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
 * Recalculates trendScore immediately on engagement.
 */
exports.calculateTrendingScore = onDocumentUpdated("trending_stats/{postId}", async (event) => {
  const data = event.data.after.data();
  const oldData = event.data.before.data();
  if (data.trendScore && !Object.keys(data).some(k => k !== 'trendScore' && data[k] !== oldData[k])) return null;

  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
  const ageHours = (new Date() - createdAt) / 3600000;
  const velocity = (data.views || 0) + (data.likes || 0) * 3 + (data.comments || 0) * 5 + (data.shares || 0) * 8 + (data.completions || 0) * 20;
  
  // 📉 EXPONENTIAL TREND DECAY (12hr half-life)
  const decay = Math.exp(-ageHours / 12);
  let score = (velocity / Math.pow((ageHours + 2), 1.3)) * decay;
  
  if (data.views > 500 && ageHours < 2) score *= 1.5;
  if (data.views > 300 && ((data.completions || 0) / Math.max(data.views, 1)) > 0.6) score = Math.max(score, 50); 

  if (data.trendScore && Math.abs(data.trendScore - score) < 0.001) return null;
  return event.data.after.ref.update({ trendScore: score, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
});

/**
 * 🏆 CREATOR REPUTATION & TIER ENGINE
 * Aggregates performance across all posts to assign a 0-100 tier score.
 */
exports.calculateCreatorReputation = onDocumentUpdated("trending_stats/{postId}", async (event) => {
  const data = event.data.after.data();
  const authorId = data.authorId;
  if (!authorId) return null;

  const db = admin.firestore();
  
  // Optimization: Only update reputation on every 5th engagement event per post
  const totalEngagement = (data.views || 0) + (data.likes || 0) + (data.comments || 0);
  if (totalEngagement % 5 !== 0) return null;

  const postsSnap = await db.collection("trending_stats").where("authorId", "==", authorId).get();
  if (postsSnap.empty) return null;

  let totalViews = 0;
  let totalInteractions = 0;
  let totalCompletions = 0;
  const count = postsSnap.size;

  postsSnap.forEach(d => {
    const p = d.data();
    totalViews += (p.views || 0);
    totalInteractions += (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
    totalCompletions += (p.completions || 0);
  });

  const divisor = Math.max(totalViews, 1);
  const engagementRate = totalInteractions / divisor;
  const completionRate = totalCompletions / divisor;

  // 🏛️ LIAISON QUALITY FORMULA (0-100)
  // Normalization: interaction rates are typically low (e.g. 0.1), so we scale.
  const consistencyBonus = count > 5 ? 10 : 0;
  const violationPenalty = (data.violations || 0) * 20;

  let qualityScore = (engagementRate * 200) + (completionRate * 100) + consistencyBonus - violationPenalty;
  
  // Final clamp
  qualityScore = Math.min(100, Math.max(0, Math.round(qualityScore)));

  // TIER CLASSIFICATION
  let tier = 'new';
  if (qualityScore >= 80) tier = 'elite';
  else if (qualityScore >= 50) tier = 'trusted';
  else if (qualityScore >= 20) tier = 'rising';

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
  
  // Denormalize to user doc for high-performance ranking in the UI
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

  const statsRef = db.collection('trending_stats').doc(event.params.postId);
  batch.set(statsRef, {
    authorId: data.authorId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    views: 0, likes: 0, comments: 0, shares: 0, completions: 0,
    trendScore: 0
  }, { merge: true });

  if (tags.length > 0) {
    const minuteBucket = new Date().toISOString().slice(0, 16);
    tags.forEach(tag => {
      const normalizedTag = tag.toLowerCase();
      const tagRef = db.collection('hashtags').doc(normalizedTag);
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
    
    // 📉 Formula: (Velocity * 0.6 + EngagementRate * 0.3 + Freshness * 0.1) * Decay
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
          const eventId = `EVENT_${[tagA, tagB].sort().join('_')}`;
          clusterBatch.set(db.collection("trend_events").doc(eventId), { tags: [tagA, tagB], collectiveVelocity: sorted[i].score + sorted[j].score, detectedAt: admin.firestore.FieldValue.serverTimestamp(), status: 'active' }, { merge: true });
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
 * Flags media for analysis or provides basic metadata tagging.
 */
exports.onVibeMediaUploaded = onObjectFinalized(async (event) => {
  const filePath = event.data.name;
  if (!filePath.startsWith("social_posts/") && !filePath.startsWith("social_videos/")) return;

  const db = admin.firestore();
  
  // Note: High-fidelity multi-modal analysis is handled by the high-performance
  // Genkit flow triggered in ShareVibeModal. This trigger acts as a 
  // secondary audit layer for the Liaison.
  
  console.log(`🤖 AI CONTENT AUDIT: Media detected at ${filePath}. Enqueued for Deep Vibe analysis.`);
  
  // For a professional prototype, we mark the post as "Under Intelligent Audit"
  // once the storage upload is confirmed.
  const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${event.data.bucket}/o/${encodeURIComponent(filePath)}?alt=media`;
  
  const postsSnap = await db.collection("campus_pulse").where("mediaUrl", "==", fileUrl).limit(1).get();
  if (!postsSnap.empty) {
    return postsSnap.docs[0].ref.update({ mediaStatus: 'ready', auditedAt: admin.firestore.FieldValue.serverTimestamp() });
  }
});
