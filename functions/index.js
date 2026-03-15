
const {onDocumentUpdated, onDocumentCreated, onDocumentDeleted} = require("firebase-functions/v2/firestore");
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
 * 🛡️ ARENA RING: SMART AUTO-MATCHMAKER
 */
exports.autoMatchBattles = onDocumentCreated("arena_waiting_pool/{entryId}", async (event) => {
  const db = admin.firestore();
  const newEntry = event.data.data();
  const entryId = event.params.entryId;

  return db.runTransaction(async (transaction) => {
    const poolQuery = db.collection("arena_waiting_pool")
      .orderBy("createdAt", "asc")
      .limit(5);

    const poolSnap = await transaction.get(poolQuery);
    const rivalDoc = poolSnap.docs.find(doc => doc.id !== entryId);

    if (!rivalDoc) {
      console.log("⏳ Arena: No rival found in pool yet. Waiting...");
      return;
    }

    const rival = rivalDoc.data();
    const battleRef = db.collection("arena_battles").doc();
    const endsAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const battleData = {
      title: newEntry.title || `Showdown: ${newEntry.campusAcronym} vs ${rival.campusAcronym}`,
      status: "live",
      creatorId: newEntry.userId,
      participants: [newEntry.userId, rival.userId],
      opponentA: {
        userId: newEntry.userId,
        videoUrl: newEntry.videoUrl,
        votes: 0
      },
      opponentB: {
        userId: rival.userId,
        videoUrl: rival.videoUrl,
        votes: 0
      },
      participantInfo: {
        [newEntry.userId]: {
          name: newEntry.userName,
          avatarUrl: newEntry.avatarUrl,
          campusAcronym: newEntry.campusAcronym,
          primaryColor: "#3b82f6"
        },
        [rival.userId]: {
          name: rival.userName,
          avatarUrl: rival.avatarUrl,
          campusAcronym: rival.campusAcronym,
          primaryColor: "#ef4444"
        }
      },
      votes: {
        [newEntry.userId]: 0,
        [rival.userId]: 0
      },
      viewerCount: 2,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      endsAt: endsAt
    };

    transaction.set(battleRef, battleData);
    transaction.delete(db.collection("arena_waiting_pool").doc(entryId));
    transaction.delete(rivalDoc.ref);

    console.log(`⚔️ Arena: Paired ${newEntry.userName} and ${rival.userName} into live battle ${battleRef.id}.`);
  });
});

/**
 * 🔥 ARENA RING: REAL-TIME SPIKE DETECTION
 * Triggers on every engagement event to detect "Hot" moments.
 */
exports.detectHighlightSpike = onDocumentCreated("arena_battles/{battleId}/engagement_events/{eventId}", async (event) => {
    const db = admin.firestore();
    const battleId = event.params.battleId;
    const battleRef = db.collection("arena_battles").doc(battleId);

    // Fetch the 20 most recent events for this specific showdown
    const recentEventsSnap = await battleRef.collection("engagement_events")
        .orderBy("timestamp", "desc")
        .limit(20)
        .get();

    if (recentEventsSnap.size < 15) return null;

    const events = recentEventsSnap.docs.map(d => d.data());
    const newest = events[0].timestamp.toMillis();
    const oldest = events[events.length - 1].timestamp.toMillis();

    // LIAISON LOGIC: 15 interactions in < 30 seconds = SPIKE DETECTED
    const timeGapMs = newest - oldest;
    if (timeGapMs < 30000) {
        console.log(`🔥 SPIKE DETECTED in Battle ${battleId}: 15 events in ${Math.round(timeGapMs/1000)}s`);
        return battleRef.update({ 
            isHot: true, 
            lastSpikeAt: admin.firestore.FieldValue.serverTimestamp() 
        });
    }

    return null;
});

/**
 * 🔔 ARENA: BATTLE AUTO-PROMOTION
 */
exports.onBattleStarted = onDocumentUpdated("arena_battles/{battleId}", async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    
    if (before.status === "waiting" && after.status === "live") {
        const db = admin.firestore();
        const p1 = after.participantInfo[after.creatorId];
        const p2 = after.opponentB ? after.participantInfo[after.opponentB.userId] : null;
        
        if (!p1 || !p2) return null;

        const title = "🔥 New Arena Battle!";
        const message = `${p1.campusAcronym} vs ${p2.campusAcronym}: "${after.title}" is LIVE!`;
        
        const campusIds = [p1.campusId, p2.campusId].filter(id => !!id);
        const usersSnap = await db.collection("users")
            .where("campusId", "in", campusIds)
            .limit(200)
            .get();

        const batch = db.batch();
        usersSnap.forEach(u => {
            const notifRef = db.collection("users").doc(u.id).collection("notifications").doc();
            batch.set(notifRef, {
                type: "battle_challenge",
                title,
                message,
                link: "/arena",
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        return batch.commit();
    }
    return null;
});

/**
 * 🛡️ ARENA RING: AUTO-END BATTLES & HIGHLIGHT GENERATION
 */
exports.endBattle = onSchedule("every 1 minutes", async (event) => {
  const db = admin.firestore();
  const now = new Date().toISOString();

  const expiredBattles = await db.collection("arena_battles")
    .where("status", "==", "live")
    .where("endsAt", "<=", now)
    .get();

  if (expiredBattles.empty) return null;

  for (const doc of expiredBattles.docs) {
    const data = doc.data();
    const info = data.participantInfo || {};
    
    const vA = data.opponentA?.votes || 0;
    const vB = data.opponentB?.votes || 0;
    const winnerId = vA > vB ? data.opponentA.userId : (vB > vA ? data.opponentB.userId : null);
    const isDraw = vA === vB;

    const batch = db.batch();
    batch.update(doc.ref, { status: "ended", endedAt: admin.firestore.FieldValue.serverTimestamp() });

    if (!isDraw && winnerId) {
        const winner = data.opponentA.userId === winnerId ? data.opponentA : data.opponentB;
        const loser = data.opponentA.userId === winnerId ? data.opponentB : data.opponentA;
        const winnerInfo = info[winnerId];
        
        const eventsSnap = await doc.ref.collection("engagement_events").orderBy("timestamp", "asc").get();
        let peakTimeOffset = 0;
        let peakEnergy = 0;

        if (!eventsSnap.empty) {
            const events = eventsSnap.docs.map(d => ({ ...d.data(), time: d.data().timestamp.toMillis() }));
            const startTime = data.createdAt.toMillis();
            const bucketSize = 10000; 
            const buckets = {};
            
            events.forEach(e => {
                const bucketIdx = Math.floor((e.time - startTime) / bucketSize);
                buckets[bucketIdx] = (buckets[bucketIdx] || 0) + (e.weight || 1);
            });

            const sortedBuckets = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
            peakTimeOffset = parseInt(sortedBuckets[0][0]) * 10; 
            peakEnergy = sortedBuckets[0][1];
        }

        const highlightRef = db.collection("arena_highlights").doc();
        batch.set(highlightRef, {
            battleId: doc.id,
            clipUrl: winner.videoUrl,
            creatorId: data.creatorId,
            opponentId: loser.userId,
            winnerId: winnerId,
            startTime: peakTimeOffset,
            endTime: peakTimeOffset + 10,
            votesSpike: peakEnergy || winner.votes,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const pulseRef = db.collection("campus_pulse").doc();
        batch.set(pulseRef, {
            authorId: winnerId,
            authorName: winnerInfo.name,
            authorAvatarUrl: winnerInfo.avatarUrl,
            campusId: winnerInfo.campusId || "all",
            campusAcronym: winnerInfo.campusAcronym,
            content: `🏆 Victory Archive: ${winnerInfo.name} dominated the Yard! Peak Intensity: ${peakEnergy || winner.votes}`,
            mediaType: "video",
            mediaUrl: winner.videoUrl,
            type: "arena_highlight",
            isArenaEntry: true,
            battleMetadata: {
                battleId: doc.id,
                winnerName: winnerInfo.name,
                totalEnergy: peakEnergy || winner.votes
            },
            likes: 0,
            commentCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    await batch.commit();
  }
  return null;
});

/**
 * 🛡️ ARENA RING: CLEANUP HELPERS
 */
exports.cancelInactiveBattles = onSchedule("every 1 minutes", async (event) => {
  const db = admin.firestore();
  const twoMinutesAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 120000));
  const stale = await db.collection("arena_battles").where("status", "==", "waiting").where("createdAt", "<=", twoMinutesAgo).get();
  if (stale.empty) return null;
  const batch = db.batch();
  stale.forEach(doc => batch.update(doc.ref, { status: "ended", cancelReason: "timeout" }));
  return batch.commit();
});

exports.pruneWaitingPool = onSchedule("every 1 minutes", async (event) => {
  const db = admin.firestore();
  const fiveMinsAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 300000));
  const stale = await db.collection("arena_waiting_pool").where("createdAt", "<=", fiveMinsAgo).get();
  if (stale.empty) return null;
  const batch = db.batch();
  stale.forEach(doc => batch.delete(doc.ref));
  return batch.commit();
});

/**
 * 🎥 MEDIA OPTIMIZATION
 */
exports.compressVideo = onObjectFinalized({
  cpu: 2, memory: "2GiB", timeoutSeconds: 300,
}, async (event) => {
  const object = event.data;
  const bucket = admin.storage().bucket(object.bucket);
  const filePath = object.name;
  if (!object.contentType || !object.contentType.startsWith("video/")) return null;
  if (!filePath.startsWith("videos/hot/") && !filePath.startsWith("product_videos/")) return null;
  if (object.metadata && object.metadata.processed === "true") return null;

  const fileName = path.basename(filePath);
  const fileHash = object.metadata?.hash || fileName.split(".")[0];
  const tempFilePath = path.join(os.tmpdir(), fileName);
  const targetFilePath = path.join(os.tmpdir(), `compressed-${fileName}`);

  try {
    await bucket.file(filePath).download({destination: tempFilePath});
    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath).size("720x?").videoBitrate("800k").videoCodec("libx264").format("mp4").on("end", resolve).on("error", reject).save(targetFilePath);
    });
    await bucket.upload(targetFilePath, {
      destination: filePath,
      metadata: { contentType: "video/mp4", metadata: { processed: "true", hash: fileHash } },
    });
    const db = admin.firestore();
    const finalUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media`;
    const hashRef = db.collection("video_hashes").doc(fileHash);
    await hashRef.set({ mediaUrl: finalUrl, processed: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    fs.unlinkSync(tempFilePath); fs.unlinkSync(targetFilePath);
  } catch (err) { console.error("Compression failed:", err); }
  return null;
});

/**
 * 🔔 NOTIFICATION TRIGGERS
 */
exports.onNotificationCreated = onDocumentCreated("users/{userId}/notifications/{notifId}", async (event) => {
  const notif = event.data.data();
  const db = admin.firestore();
  const userSnap = await db.collection("users").doc(event.params.userId).get();
  const token = userSnap.data()?.fcmToken;
  if (!token) return null;
  try {
    await admin.messaging().send({
      notification: { title: notif.title, body: notif.message },
      data: { link: notif.link || "", type: notif.type },
      token: token
    });
  } catch (err) { console.error("FCM Error:", err); }
  return null;
});
