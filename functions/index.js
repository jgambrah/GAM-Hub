
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentUpdated, onDocumentCreated} =
    require("firebase-functions/v2/firestore");
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
 * Triggers on any engagement update to recalculate the trendScore immediately.
 */
exports.calculateTrendingScore = onDocumentUpdated("trending_stats/{postId}", async (event) => {
  const data = event.data.after.data();
  const oldData = event.data.before.data();

  if (data.trendScore && !Object.keys(data).some(k => k !== 'trendScore' && data[k] !== oldData[k])) {
    return null;
  }

  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
  const now = new Date();
  const ageHours = (now - createdAt) / 3600000;

  const views = data.views || 0;
  const likes = data.likes || 0;
  const comments = data.comments || 0;
  const shares = data.shares || 0;
  const completions = data.completions || 0;

  const velocity = (views * 1) + (likes * 3) + (comments * 5) + (shares * 8) + (completions * 20);
  let score = velocity / Math.pow((ageHours + 2), 1.3);

  if (views > 500 && ageHours < 2) {
    score *= 1.5;
  }

  // 🎓 VIRAL GRADUATION THRESHOLD
  if (views > 300 && (completions / Math.max(views, 1)) > 0.6) {
    score = Math.max(score, 50); 
  }

  if (data.trendScore && Math.abs(data.trendScore - score) < 0.001) {
    return null;
  }

  return event.data.after.ref.update({ 
    trendScore: score,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
});

/**
 * #️⃣ HASHTAG INDEXER & VELOCITY TRACKER
 * Updates global registry and per-minute statistics when a new vibration is created.
 */
exports.onVibeCreatedUpdateHashtags = onDocumentCreated("campus_pulse/{postId}", async (event) => {
  const data = event.data.data();
  const tags = data.tags || [];
  if (tags.length === 0) return;

  const db = admin.firestore();
  const batch = db.batch();
  const minuteBucket = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm

  tags.forEach(tag => {
    const normalizedTag = tag.toLowerCase();
    
    // 1. Update Global Registry
    const tagRef = db.collection('hashtags').doc(normalizedTag);
    batch.set(tagRef, {
      tag: normalizedTag,
      postCount: admin.firestore.FieldValue.increment(1),
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. Update Velocity Bucket (Time-Series) for Virality Detection
    const statsRef = db.collection("hashtagStats")
      .doc(normalizedTag)
      .collection("minutes")
      .doc(minuteBucket);
      
    batch.set(statsRef, {
      count: admin.firestore.FieldValue.increment(1)
    }, { merge: true });
  });

  await batch.commit();
});

/**
 * 📈 TRENDING HASHTAG UPDATER (PROFESSIONAL VELOCITY ENGINE)
 * Calculates hashtag velocity, trending scores, and identifies TRENDING CLUSTERS.
 */
exports.updateTrendingHashtags = onSchedule("every 5 minutes", async (event) => {
  const db = admin.firestore();
  const hashtagsSnapshot = await db.collection("hashtags").get();
  const now = new Date();
  const batch = db.batch();

  const lookbackMins = 30;
  const startTime = new Date(now.getTime() - lookbackMins * 60000);
  const startTimeString = startTime.toISOString().slice(0, 16);

  const trendingPool = [];

  const processPromises = hashtagsSnapshot.docs.map(async (docSnap) => {
    const tag = docSnap.id;
    const data = docSnap.data();
    
    const statsSnapshot = await db.collection("hashtagStats")
      .doc(tag)
      .collection("minutes")
      .where("__name__", ">=", startTimeString)
      .get();

    const counts = statsSnapshot.docs.map(d => d.data().count || 0);
    const totalNewPosts = counts.reduce((a, b) => a + b, 0);
    const velocity = totalNewPosts / lookbackMins;

    const lastUsedAt = data.lastUsedAt?.toDate ? data.lastUsedAt.toDate() : now;
    const ageMinutes = Math.max(0, (now.getTime() - lastUsedAt.getTime()) / 60000);
    const ageHours = ageMinutes / 60;
    const freshness = 1 / (ageMinutes + 1);
    const engagement = velocity > 0 ? 0.5 : 0; 

    // LIAISON VIRAL LIFECYCLE: Apply exponential decay (12h half-life)
    const halfLife = 12;
    const decay = Math.exp(-ageHours / halfLife);

    const baseScore = (velocity * 0.6) + (engagement * 0.3) + (freshness * 0.1);
    const trendScore = baseScore * decay;

    batch.update(docSnap.ref, {
      trendScore,
      velocity,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (trendScore > 10) {
      trendingPool.push({ tag, score: trendScore, ref: docSnap.ref });
    }

    // 🛡️ VIRAL THRESHOLD PROMOTION
    if (trendScore > 30) {
      const viralRef = db.collection("viral_hashtags").doc(tag);
      batch.set(viralRef, {
        tag,
        trendScore,
        detectedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  await Promise.all(processPromises);

  // 🕸️ TRENDING CLUSTER DETECTION (Semantic Pass)
  const clusterBatch = db.batch();
  if (trendingPool.length >= 2) {
    const sortedPool = trendingPool.sort((a, b) => b.score - a.score).slice(0, 15);
    
    for (let i = 0; i < sortedPool.length; i++) {
      for (let j = i + 1; j < sortedPool.length; j++) {
        const tagA = sortedPool[i].tag;
        const tagB = sortedPool[j].tag;
        
        // Check graph weight
        const edgeRef = db.collection("hashtagGraph").doc(tagA).collection("edges").doc(tagB);
        const edgeSnap = await edgeRef.get();
        
        if (edgeSnap.exists() && edgeSnap.data().weight > 20) {
          // CLUSTER DETECTED: Mark tags as part of an active event
          const eventId = `EVENT_${[tagA, tagB].sort().join('_')}`;
          clusterBatch.set(db.collection("trend_events").doc(eventId), {
            tags: [tagA, tagB],
            collectiveVelocity: sortedPool[i].score + sortedPool[j].score,
            detectedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active'
          }, { merge: true });

          // Update tags with event ID for UI badging
          clusterBatch.update(sortedPool[i].ref, { activeEventId: eventId });
          clusterBatch.update(sortedPool[j].ref, { activeEventId: eventId });
        }
      }
    }
  }

  await batch.commit();
  await clusterBatch.commit();
});

// ... [rest of functions/index.js OMITTED for brevity as they remain unchanged] ...
