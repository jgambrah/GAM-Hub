
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
 * When a student enters the waiting pool, look for a rival and pair them using a transaction.
 * Preferred: Inter-campus rivalries.
 */
exports.autoMatchBattles = onDocumentCreated("arena_waiting_pool/{entryId}", async (event) => {
  const db = admin.firestore();
  const newEntry = event.data.data();
  const entryId = event.params.entryId;

  return db.runTransaction(async (transaction) => {
    // 1. Find oldest entry in pool (excluding self)
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

    // 2. Pair Found: Initialize LIVE Battle
    const battleRef = db.collection("arena_battles").doc();
    
    // Calculate 15 mins from now
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

    // Atomic Handshake: Create Battle & Delete Pool Entries
    transaction.set(battleRef, battleData);
    transaction.delete(db.collection("arena_waiting_pool").doc(entryId));
    transaction.delete(rivalDoc.ref);

    console.log(`⚔️ Arena: Paired ${newEntry.userName} and ${rival.userName} into live battle ${battleRef.id}.`);
  });
});

/**
 * 🔔 ARENA: BATTLE AUTO-PROMOTION
 * Notify relevant campus users when a battle goes LIVE.
 */
exports.onBattleStarted = onDocumentUpdated("arena_battles/{battleId}", async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    
    // Only trigger when transitioning from waiting -> live
    if (before.status === "waiting" && after.status === "live") {
        const db = admin.firestore();
        const p1 = after.participantInfo[after.creatorId];
        const p2 = after.opponentB ? after.participantInfo[after.opponentB.userId] : null;
        
        if (!p1 || !p2) return null;

        const title = "🔥 New Arena Battle!";
        const message = `${p1.campusAcronym} vs ${p2.campusAcronym}: "${after.title}" is LIVE!`;
        
        // Find a subset of students to notify
        const campusIds = [after.participantInfo[after.creatorId].campusId, p2.campusId].filter(id => !!id);
        const usersSnap = await db.collection("users")
            .where("campusId", "in", campusIds)
            .limit(200)
            .get();

        const batch = db.batch();
        usersSnap.forEach(u => {
            const notifRef = db.collection("users").doc(u.id).collection("notifications").doc();
            batch.set(notifRef, {
                type: "system",
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
 * 🛡️ ARENA RING: AUTO-END BATTLES, HIGHLIGHT DETECTION & LEADERBOARD SYNC
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
    const votes = data.votes || {};
    const participants = data.participants || [];
    const info = data.participantInfo || {};
    
    const vA = data.opponentA?.votes || 0;
    const vB = data.opponentB?.votes || 0;
    const winnerId = vA > vB ? data.opponentA.userId : (vB > vA ? data.opponentB.userId : null);
    const isDraw = vA === vB;

    const batch = db.batch();

    batch.update(doc.ref, { 
      status: "ended", 
      endedAt: admin.firestore.FieldValue.serverTimestamp() 
    });

    // 🎬 REPLAY ENGINE: Advanced Spike Detection
    if (!isDraw && winnerId) {
        const winner = data.opponentA.userId === winnerId ? data.opponentA : data.opponentB;
        const loser = data.opponentA.userId === winnerId ? data.opponentB : data.opponentA;
        const winnerInfo = info[winnerId];
        
        // Fetch engagement events to find the PEAK SPIKE
        const eventsSnap = await doc.ref.collection("engagement_events").orderBy("timestamp", "asc").get();
        let peakEnergy = 0;
        let peakTimeOffset = 0;

        if (!eventsSnap.empty) {
            const events = eventsSnap.docs.map(d => ({ ...d.data(), time: d.data().timestamp.toMillis() }));
            const startTime = data.createdAt.toMillis();
            
            // Analyze 10-second buckets for peak energy velocity
            const bucketSize = 10000; 
            const buckets = {};
            
            events.forEach(e => {
                const bucketIdx = Math.floor((e.time - startTime) / bucketSize);
                buckets[bucketIdx] = (buckets[bucketIdx] || 0) + (e.weight || 1);
            });

            // Find the bucket with most weighted interaction
            const peakBucketIdx = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0][0];
            peakTimeOffset = parseInt(peakBucketIdx) * 10; 
            peakEnergy = buckets[peakBucketIdx];
        }

        const highlightRef = db.collection("arena_highlights").doc();
        const highlightData = {
            battleId: doc.id,
            clipUrl: winner.videoUrl,
            creatorId: data.creatorId,
            opponentId: loser.userId,
            winnerId: winnerId,
            startTime: peakTimeOffset,
            endTime: peakTimeOffset + 10,
            votesSpike: peakEnergy || winner.votes,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.set(highlightRef, highlightData);

        // Publish to Campus Pulse
        const pulseRef = db.collection("campus_pulse").doc();
        batch.set(pulseRef, {
            authorId: winnerId,
            authorName: winnerInfo.name,
            authorAvatarUrl: winnerInfo.avatarUrl,
            campusId: winnerInfo.campusId || "all",
            campusAcronym: winnerInfo.campusAcronym,
            content: `🏆 Victory Archive: ${winnerInfo.name} dominated the Yard at the ${peakTimeOffset}s mark! Peak Intensity: ${peakEnergy || winner.votes}`,
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

    for (const pId of participants) {
      const isWinner = !isDraw && pId === winnerId;
      const receivedVotes = votes[pId] || (pId === data.opponentA?.userId ? vA : vB);
      const pInfo = info[pId] || {};
      
      const leaderRef = db.collection("arena_leaderboard").doc(pId);
      batch.set(leaderRef, {
        userId: pId,
        name: pInfo.name || "Anonymous",
        avatarUrl: pInfo.avatarUrl || "",
        campusAcronym: pInfo.campusAcronym || "GH",
        wins: admin.firestore.FieldValue.increment(isWinner ? 1 : 0),
        losses: admin.firestore.FieldValue.increment(!isWinner && !isDraw ? 1 : 0),
        votes_received: admin.firestore.FieldValue.increment(receivedVotes),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    await batch.commit();
  }

  return null;
});

/**
 * 🛡️ ARENA RING: CANCEL INACTIVE CHALLENGES
 */
exports.cancelInactiveBattles = onSchedule("every 1 minutes", async (event) => {
  const db = admin.firestore();
  const twoMinutesAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 120000));

  const staleChallenges = await db.collection("arena_battles")
    .where("status", "==", "waiting")
    .where("createdAt", "<=", twoMinutesAgo)
    .get();

  if (staleChallenges.empty) return null;

  const batch = db.batch();
  staleChallenges.forEach(doc => {
    batch.update(doc.ref, { 
      status: "ended",
      cancelReason: "timeout_no_opponent"
    });
  });

  await batch.commit();
  return null;
});

/**
 * 🛡️ ARENA RING: PRUNE & GRADUATE WAITING POOL
 */
exports.pruneWaitingPool = onSchedule("every 1 minutes", async (event) => {
  const db = admin.firestore();
  const thirtySecondsAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 30000));
  const fiveMinutesAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 300000));

  const staleEntries = await db.collection("arena_waiting_pool")
    .where("createdAt", "<=", thirtySecondsAgo)
    .get();

  if (staleEntries.empty) return null;

  const batch = db.batch();
  
  staleEntries.forEach(doc => {
    const data = doc.data();
    if (data.createdAt.toMillis() <= fiveMinutesAgo.toMillis()) {
        batch.delete(doc.ref);
    } else {
        const battleRef = db.collection("arena_battles").doc();
        batch.set(battleRef, {
            title: data.title || "Open Auto-Match Challenge",
            creatorId: data.userId,
            status: "waiting",
            participants: [data.userId],
            opponentA: {
                userId: data.userId,
                videoUrl: data.videoUrl,
                votes: 0
            },
            opponentB: null,
            participantInfo: {
                [data.userId]: {
                    name: data.userName,
                    avatarUrl: data.avatarUrl,
                    campusAcronym: data.campusAcronym,
                    primaryColor: "#0f172a"
                }
            },
            viewerCount: 1,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        });
        batch.delete(doc.ref);
    }
  });

  return batch.commit();
});

/**
 * 🔔 ARENA RING: NOTIFICATION ON DIRECT CHALLENGE
 */
exports.onBattleCreated = onDocumentCreated("arena_battles/{battleId}", async (event) => {
    const battle = event.data.data();
    if (!battle.targetUserId || battle.status !== "waiting") return null;

    const db = admin.firestore();
    const notifRef = db.collection("users").doc(battle.targetUserId).collection("notifications").doc();
    return notifRef.set({
        type: "battle_challenge",
        title: "🔥 You were challenged!",
        message: `${battle.creatorName} wants to battle you: "${battle.title}"`,
        link: "/arena",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
});

/**
 * 🏛️ CAMPUS WAR: AUTO-END WARS & NATIONAL LEADERBOARD SYNC
 */
exports.endWar = onSchedule("every 1 minutes", async (event) => {
  const db = admin.firestore();
  const now = new Date().toISOString();

  const expiredWars = await db.collection("campus_wars")
    .where("status", "==", "live")
    .where("endsAt", "<=", now)
    .get();

  if (expiredWars.empty) return null;

  const batch = db.batch();

  for (const doc of expiredWars.docs) {
    const war = doc.data();
    const warId = doc.id;

    const shardsSnap = await db.collection("campus_wars").doc(warId).collection("vote_shards").get();
    let votesA = 0;
    let votesB = 0;
    shardsSnap.forEach(s => {
        const d = s.data();
        votesA += d.votesA || 0;
        votesB += d.votesB || 0;
    });

    const winnerId = votesA > votesB ? war.campusAId : (votesB > votesA ? war.campusBId : null);
    const isDraw = votesA === votesB;

    batch.update(doc.ref, {
        status: "ended",
        votesA,
        votesB,
        closedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const updateCampus = (campusId, isWinner, votes) => {
        const ref = db.collection("campus_leaderboard").doc(campusId);
        batch.set(ref, {
            id: campusId,
            wins: admin.firestore.FieldValue.increment(isWinner ? 1 : 0),
            losses: admin.firestore.FieldValue.increment(!isWinner && !isDraw ? 1 : 0),
            totalVotes: admin.firestore.FieldValue.increment(votes),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    };

    updateCampus(war.campusAId, winnerId === war.campusAId, votesA);
    updateCampus(war.campusBId, winnerId === war.campusBId, votesB);

    const resultTitle = "🏆 Campus War Result!";
    const resultMsg = isDraw 
        ? `The War between ${war.campusAInfo.acronym} and ${war.campusBInfo.acronym} ended in a DRAW! 🤝`
        : `${winnerId === war.campusAId ? war.campusAInfo.acronym : war.campusBInfo.acronym} has emerged VICTORIOUS in the national arena! 👑`;

    const usersSnap = await db.collection("users")
        .where("campusId", "in", [war.campusAId, war.campusBId])
        .limit(200)
        .get();

    usersSnap.forEach(u => {
        batch.set(db.collection("users").doc(u.id).collection("notifications").doc(), {
            type: "war",
            title: resultTitle,
            message: resultMsg,
            link: "/arena",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
  }

  await batch.commit();
  return null;
});

/**
 * 🏛️ CAMPUS WAR: NOTIFICATION ON CREATION
 */
exports.onWarCreated = onDocumentCreated("campus_wars/{warId}", async (event) => {
    const war = event.data.data();
    const db = admin.firestore();
    
    const usersSnap = await db.collection("users")
        .where("campusId", "in", [war.campusAId, war.campusBId])
        .limit(300) 
        .get();
        
    const batch = db.batch();
    
    usersSnap.forEach(u => {
        const notifRef = db.collection("users").doc(u.id).collection("notifications").doc();
        batch.set(notifRef, {
            type: "war",
            title: "🔥 Campus War Declared!",
            message: `${war.campusAInfo.acronym} vs ${war.campusBInfo.acronym}. Defend your Yard!`,
            link: "/arena",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    
    return batch.commit();
});

/**
 * 🎥 HLS & COMPRESSION ENGINE
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

  if (!contentType || !contentType.startsWith("video/")) return null;
  
  const isEligiblePath = filePath.startsWith("videos/hot/") || filePath.startsWith("product_videos/");
  if (!isEligiblePath || filePath.includes("/hls/")) return null;
  
  if (object.metadata && object.metadata.processed === "true") return null;

  const fileName = path.basename(filePath);
  const fileHash = object.metadata?.hash || fileName.split(".")[0];
  const tempDir = path.join(os.tmpdir(), fileHash);
  
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  const tempFilePath = path.join(os.tmpdir(), fileName);
  const targetFilePath = path.join(os.tmpdir(), `compressed-${fileName}`);
  const thumbFileName = `thumb-${fileHash}.jpg`;
  const thumbTempPath = path.join(os.tmpdir(), thumbFileName);
  
  const hlsPlaylistName = "playlist.m3u8";
  const hlsOutputDir = path.join(tempDir, "hls");
  if (!fs.existsSync(hlsOutputDir)) fs.mkdirSync(hlsOutputDir);

  try {
    await bucket.file(filePath).download({destination: tempFilePath});

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

    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .size("720x?")
        .videoBitrate("800k")
        .videoCodec("libx264")
        .addOption("-hls_time", "6")
        .addOption("-hls_list_size", "0")
        .addOption("-hls_segment_filename", path.join(hlsOutputDir, "segment%03d.ts"))
        .on("end", resolve)
        .on("error", reject)
        .save(path.join(hlsOutputDir, hlsPlaylistName));
    });

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
    const hlsStorageDir = `videos/hls/${fileHash}`;
    
    const uploads = [
      bucket.upload(targetFilePath, {
        destination: filePath,
        metadata: {
          contentType: "video/mp4",
          metadata: { 
            processed: "true", 
            compressedAt: new Date().toISOString(),
            hash: fileHash 
          },
        },
      }),
      bucket.upload(thumbTempPath, {
        destination: thumbStoragePath,
        metadata: { 
          contentType: "image/jpeg",
          cacheControl: "public, max-age=31536000"
        },
      })
    ];

    const hlsFiles = fs.readdirSync(hlsOutputDir);
    hlsFiles.forEach(file => {
      const isPlaylist = file.endsWith('.m3u8');
      uploads.push(bucket.upload(path.join(hlsOutputDir, file), {
        destination: `${hlsStorageDir}/${file}`,
        metadata: { 
          contentType: isPlaylist ? 'application/vnd.apple.mpegurl' : 'video/MP2T',
          cacheControl: "public, max-age=31536000" 
        }
      }));
    });

    await Promise.all(uploads);

    const db = admin.firestore();
    const publicBase = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/`;
    const finalMediaUrl = `${publicBase}${encodeURIComponent(filePath)}?alt=media`;
    const thumbUrl = `${publicBase}${encodeURIComponent(thumbStoragePath)}?alt=media`;
    const hlsUrl = `${publicBase}${encodeURIComponent(`${hlsStorageDir}/${hlsPlaylistName}`)}?alt=media`;

    const batch = db.batch();
    
    const pulseSnap = await db.collection("campus_pulse").where("videoHash", "==", fileHash).get();
    pulseSnap.forEach(doc => {
      batch.update(doc.ref, { 
        mediaUrl: finalMediaUrl,
        hlsUrl: hlsUrl,
        imageUrl: thumbUrl, 
        storageTier: 'hot', 
        storagePath: filePath 
      });
    });

    const hashRef = db.collection("video_hashes").doc(fileHash);
    batch.set(hashRef, {
      mediaUrl: finalMediaUrl,
      hlsUrl: hlsUrl,
      imageUrl: thumbUrl,
      storagePath: filePath,
      storageTier: 'hot',
      processed: true,
      updatedAt: admin.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();

    [tempFilePath, targetFilePath, thumbTempPath].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
    
  } catch (err) {
    console.error(`Liaison Media Optimization failed for ${filePath}:`, err);
  }

  return null;
});

/**
 * 🔔 NOTIFICATION ENGINE
 */

exports.onNotificationCreated = onDocumentCreated("users/{userId}/notifications/{notifId}", async (event) => {
  const notif = event.data.data();
  const userId = event.params.userId;
  const db = admin.firestore();

  const userSnap = await db.collection("users").doc(userId).get();
  const userData = userSnap.data();
  const token = userData?.fcmToken;

  if (!token) return null;

  const payload = {
    notification: {
      title: notif.title,
      body: notif.message,
    },
    data: {
      link: notif.link || "",
      type: notif.type,
      notifId: event.params.notifId,
    },
    token: token
  };

  try {
    await admin.messaging().send(payload);
    console.log(`📡 Liaison FCM: Dispatched push to ${userId} for ${notif.type}`);
  } catch (err) {
    console.error("Liaison FCM Dispatch Error:", err);
  }
  return null;
});

exports.onCommentCreated = onDocumentCreated("campus_pulse/{postId}/comments/{commentId}", async (event) => {
  const comment = event.data.data();
  const db = admin.firestore();
  
  const postSnap = await db.collection("campus_pulse").doc(event.params.postId).get();
  if (!postSnap.exists) return null;
  const post = postSnap.data();
  
  if (post.authorId === comment.userId) return null;

  return db.collection("users").doc(post.authorId).collection("notifications").add({
    type: "comment",
    title: "New Comment",
    message: `${comment.userName} commented on your vibration.`,
    actorId: comment.userId,
    actorName: comment.userName,
    link: `/pulse?postId=${event.params.postId}`,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
});

exports.onLikeCreated = onDocumentCreated("campus_pulse/{postId}/likedBy/{userId}", async (event) => {
  const db = admin.firestore();
  
  const postSnap = await db.collection("campus_pulse").doc(event.params.postId).get();
  if (!postSnap.exists) return null;
  const post = postSnap.data();
  
  if (post.authorId === event.params.userId) return null;

  const actorSnap = await db.collection("users").doc(event.params.userId).get();
  const actor = actorSnap.data();

  return db.collection("users").doc(post.authorId).collection("notifications").add({
    type: "like",
    title: "Vibration Boosted",
    message: `${actor?.name || "A student"} liked your vibration.`,
    actorId: event.params.userId,
    actorName: actor?.name || "Member",
    link: `/pulse?postId=${event.params.postId}`,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
});

exports.onOrderCreated = onDocumentCreated("orders/{orderId}", async (event) => {
  const order = event.data.data();
  const db = admin.firestore();

  return db.collection("users").doc(order.vendorId).collection("notifications").add({
    type: "order",
    title: "New Order",
    message: `${order.buyerName} requested stock for ${order.productName}.`,
    actorId: order.buyerId,
    actorName: order.buyerName,
    link: "/vendor/orders",
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
});

exports.onChatMessageCreated = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
  const message = event.data.data();
  const db = admin.firestore();
  
  const chatSnap = await db.collection("chats").doc(event.params.chatId).get();
  const chat = chatSnap.data();
  
  const recipientId = chat.users.find(uid => uid !== message.senderId);
  if (!recipientId) return null;

  return db.collection("users").doc(recipientId).collection("notifications").add({
    type: "message",
    title: "New Message",
    message: `${message.senderName}: ${message.text || "📷 Shared media"}`,
    actorId: message.senderId,
    actorName: message.senderName,
    link: "/chat",
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
});

exports.pruneNotifications = onSchedule("every 24 hours", async (event) => {
  const db = admin.firestore();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const expiredSnap = await db.collectionGroup("notifications")
    .where("createdAt", "<", thirtyDaysAgo)
    .limit(500)
    .get();

  if (expiredSnap.empty) return null;

  const batch = db.batch();
  expiredSnap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  console.log(`扫 Liaison: Pruned ${expiredSnap.size} stale notifications from the Yard.`);
  return null;
});

exports.onPulseDeleted = onDocumentDeleted("campus_pulse/{postId}", async (event) => {
  const post = event.data.data();
  if (!post || (post.mediaType !== 'video' && post.mediaType !== 'native') || !post.videoHash) return null;

  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const hashRef = db.collection("video_hashes").doc(post.videoHash);
  
  return db.runTransaction(async (transaction) => {
    const hashSnap = await transaction.get(hashRef);
    if (!hashSnap.exists()) return;

    const data = hashSnap.data();
    const newUploads = (data.uploads || 1) - 1;

    if (newUploads > 0) {
      transaction.update(hashRef, { uploads: newUploads });
    } else {
      if (data.storagePath) {
        await bucket.file(data.storagePath).delete().catch(() => null);
        const thumbPath = `videos/thumbs/thumb-${post.videoHash}.jpg`;
        await bucket.file(thumbPath).delete().catch(() => null);
        await bucket.deleteFiles({ prefix: `videos/hls/${post.videoHash}/` }).catch(() => null);
      }
      transaction.delete(hashRef);
    }
  });
});

exports.manageVideoLifecycle = onSchedule("every 24 hours", async (event) => {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  try {
    const coldSnap = await db.collection("campus_pulse")
      .where("mediaType", "==", "video")
      .where("likes", "<", 50)
      .where("createdAt", "<", ninetyDaysAgo.toISOString())
      .get();

    for (const doc of coldSnap.docs) {
      const data = doc.data();
      if (data.storageTier === 'cold' || !data.storagePath) continue;
      
      const oldPath = data.storagePath;
      const newPath = oldPath.replace("videos/hot/", "videos/cold/").replace("videos/warm/", "videos/cold/");
      
      if (oldPath !== newPath) {
          await bucket.file(oldPath).move(newPath);
          await bucket.file(newPath).setStorageClass("COLDLINE");
          const newUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(newPath)}?alt=media`;
          await doc.ref.update({ mediaUrl: newUrl, storageTier: 'cold', storagePath: newPath });
      }
    }
  } catch (err) {
    console.error("❌ Lifecycle Error:", err);
  }
});
