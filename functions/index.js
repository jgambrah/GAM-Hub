
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
 * 🎥 STARTUP-SAFE VIDEO COMPRESSION & THUMBNAIL ENGINE (Tier 1)
 * Upgraded with Deduplication Sync.
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
  
  // Support hot storage path or product videos path
  const isEligiblePath = filePath.startsWith("videos/hot/") || filePath.startsWith("product_videos/");
  if (!isEligiblePath) return null;
  
  if (object.metadata && object.metadata.processed === "true") return null;

  const fileName = path.basename(filePath);
  const tempFilePath = path.join(os.tmpdir(), fileName);
  const targetFilePath = path.join(os.tmpdir(), `compressed-${fileName}`);
  const thumbFileName = `thumb-${fileName.split(".")[0]}.jpg`;
  const thumbTempPath = path.join(os.tmpdir(), thumbFileName);

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
      bucket.upload(targetFilePath, {
        destination: filePath,
        metadata: {
          contentType: "video/mp4",
          metadata: { 
            processed: "true", 
            compressedAt: new Date().toISOString(),
            hash: object.metadata?.hash || "" 
          },
        },
      }),
      bucket.upload(thumbTempPath, {
        destination: thumbStoragePath,
        metadata: { contentType: "image/jpeg" },
      })
    ]);

    const db = admin.firestore();
    const publicBase = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/`;
    const originalUrlMatch = `${publicBase}${encodeURIComponent(filePath)}?alt=media`;
    const thumbUrl = `${publicBase}${encodeURIComponent(thumbStoragePath)}?alt=media`;

    const batch = db.batch();
    
    // 1. Update all Pulse posts referencing this file
    const pulseSnap = await db.collection("campus_pulse").where("mediaUrl", "==", originalUrlMatch).get();
    pulseSnap.forEach(doc => {
      batch.update(doc.ref, { imageUrl: thumbUrl, storageTier: 'hot', storagePath: filePath });
    });

    // 2. Update Deduplication Registry 🧬
    const fileHash = object.metadata?.hash;
    if (fileHash) {
      const hashRef = db.collection("video_hashes").doc(fileHash);
      batch.set(hashRef, {
        mediaUrl: originalUrlMatch,
        imageUrl: thumbUrl,
        storagePath: filePath,
        storageTier: 'hot',
        processed: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

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
 * 🛡️ DEDUPLICATION-SAFE DELETION TRIGGER
 * Ensures shared video files are only deleted when NO more posts reference them.
 */
exports.onPulseDeleted = onDocumentDeleted("campus_pulse/{postId}", async (event) => {
  const post = event.data.data();
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  if (!post || post.mediaType !== 'video' || !post.videoHash) return null;

  const hashRef = db.collection("video_hashes").doc(post.videoHash);
  
  return db.runTransaction(async (transaction) => {
    const hashSnap = await transaction.get(hashRef);
    if (!hashSnap.exists()) return;

    const data = hashSnap.data();
    const newUploads = (data.uploads || 1) - 1;

    if (newUploads > 0) {
      // Still other posts using this file. Just decrement count.
      transaction.update(hashRef, { uploads: newUploads });
      console.log(`Deduplication Safety: File ${post.videoHash} preserved. ${newUploads} references remain.`);
    } else {
      // LAST POST DELETED: Safe to purge the physical file 🧹
      if (data.storagePath) {
        await bucket.file(data.storagePath).delete().catch(() => null);
        // Also delete thumbnail if exists
        const thumbPath = data.storagePath.replace('videos/hot/', 'videos/thumbs/').replace('.mp4', '.jpg');
        await bucket.file(thumbPath).delete().catch(() => null);
      }
      transaction.delete(hashRef);
      console.log(`Deduplication Purge: Physical file for hash ${post.videoHash} removed.`);
    }
  });
});

/**
 * ⛅ HYBRID STORAGE LIFECYCLE (Tier 2 & 3)
 */
exports.manageVideoLifecycle = onSchedule("every 24 hours", async (event) => {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  try {
    // 1. ZOMBIE CLEANUP: Identify posts to delete. 
    // The onPulseDeleted trigger will handle the physical file safety.
    const zombieSnap = await db.collection("campus_pulse")
      .where("mediaType", "==", "video")
      .where("likes", "==", 0)
      .where("createdAt", "<", thirtyDaysAgo.toISOString())
      .get();

    for (const doc of zombieSnap.docs) {
      await doc.ref.delete();
    }

    // 2. TIER 3: COLD STORAGE MIGRATION
    const coldSnap = await db.collection("campus_pulse")
      .where("mediaType", "==", "video")
      .where("likes", "<", 50)
      .where("createdAt", "<", ninetyDaysAgo.toISOString())
      .get();

    for (const doc of coldSnap.docs) {
      const data = doc.data();
      if (data.storageTier === 'cold') continue;
      if (data.mediaUrl && data.mediaUrl.includes(bucket.name)) {
        const oldPath = decodeURIComponent(data.mediaUrl.split("/o/")[1].split("?")[0]);
        const newPath = oldPath.replace("videos/hot/", "videos/cold/").replace("videos/warm/", "videos/cold/");
        if (oldPath !== newPath) {
            await bucket.file(oldPath).move(newPath);
            await bucket.file(newPath).setStorageClass("COLDLINE");
            const newUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(newPath)}?alt=media`;
            await doc.ref.update({ mediaUrl: newUrl, storageTier: 'cold', storagePath: newPath });
        }
      }
    }

    // 3. TIER 2: WARM STORAGE MIGRATION
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
            await bucket.file(oldPath).move(newPath);
            await bucket.file(newPath).setStorageClass("NEARLINE");
            const newUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(newPath)}?alt=media`;
            await doc.ref.update({ mediaUrl: newUrl, storageTier: 'warm', storagePath: newPath });
        }
      }
    }
  } catch (err) {
    console.error("❌ Lifecycle Error:", err);
  }
});

exports.aggregateGlobalTrends = onSchedule("every 5 minutes", async (event) => {
  const db = admin.firestore();
  const since = admin.firestore.Timestamp.fromMillis(Date.now() - (60 * 60 * 1000));
  try {
    const snapshot = await db.collection("trend_events").where("timestamp", ">", since).get();
    const scores = { _updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    snapshot.forEach(doc => {
      const e = doc.data();
      if (e.entityId) scores[e.entityId] = (scores[e.entityId] || 0) + 1;
      if (e.tag) { const t = e.tag.toLowerCase(); scores[t] = (scores[t] || 0) + 1; }
    });
    await db.collection("trend_scores").doc("current").set(scores);
  } catch (err) { console.error(err); }
});
