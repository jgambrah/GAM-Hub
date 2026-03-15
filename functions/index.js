
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
 * 🛡️ ARENA RING: AUTO-END BATTLES & LEADERBOARD SYNC
 */
exports.endBattle = onSchedule("every 1 minutes", async (event) => {
  const db = admin.firestore();
  const now = new Date().toISOString();

  const expiredBattles = await db.collection("arena_battles")
    .where("status", "==", "live")
    .where("endsAt", "<=", now)
    .get();

  if (expiredBattles.empty) return null;

  const batch = db.batch();

  for (const doc of expiredBattles.docs) {
    const data = doc.data();
    const votes = data.votes || {};
    const participants = data.participants || [];
    const info = data.participantInfo || {};
    
    const vA = data.opponentA?.votes || 0;
    const vB = data.opponentB?.votes || 0;
    const winnerId = vA > vB ? data.opponentA.userId : (vB > vA ? data.opponentB.userId : null);
    const isDraw = vA === vB;

    batch.update(doc.ref, { 
      status: "ended", 
      endedAt: admin.firestore.FieldValue.serverTimestamp() 
    });

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
  }

  await batch.commit();
  console.log(`⚔️ Liaison Arena: Closed ${expiredBattles.size} expired showdowns and updated Leaderboard.`);
  return null;
});

/**
 * 🛡️ ARENA RING: CANCEL INACTIVE CHALLENGES
 * If nobody joins or creator doesn't select an opponent after 2 minutes, auto cancel.
 */
exports.cancelInactiveBattles = onSchedule("every 1 minutes", async (event) => {
  const db = admin.firestore();
  
  // Logic: Find waiting battles older than 2 minutes
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
  console.log(`🧹 Liaison Arena: Cancelled ${staleChallenges.size} stale challenges.`);
  return null;
});

/**
 * 🛡️ ARENA RING: NOTIFICATION ON DIRECT CHALLENGE
 */
exports.onBattleCreated = onDocumentCreated("arena_battles/{battleId}", async (event) => {
    const battle = event.data.data();
    const battleId = event.params.battleId;
    if (!battle.targetUserId) return null;

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
  console.log(`🏛️ Liaison Hub: Closed ${expiredWars.size} expired National Wars.`);
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
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
  
  console.log(`🧹 Liaison: Pruned ${expiredSnap.size} stale notifications from the Yard.`);
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
