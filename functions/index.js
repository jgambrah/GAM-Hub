
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
 * 🎥 STARTUP-SAFE VIDEO COMPRESSION & THUMBNAIL ENGINE
 * Processes raw uploads into optimized 720p vibrations and generates 20KB previews.
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
  
  // Logic: Support both Pulse vibrations and Marketplace demos
  const isEligiblePath = filePath.startsWith("videos/hot/") || filePath.startsWith("product_videos/");
  if (!isEligiblePath) return null;
  
  // Guard: Prevent infinite loops
  if (object.metadata && object.metadata.processed === "true") return null;

  const fileName = path.basename(filePath);
  const tempFilePath = path.join(os.tmpdir(), fileName);
  const targetFilePath = path.join(os.tmpdir(), `compressed-${fileName}`);
  const thumbFileName = `thumb-${fileName.split(".")[0]}.jpg`;
  const thumbTempPath = path.join(os.tmpdir(), thumbFileName);

  try {
    await bucket.file(filePath).download({destination: tempFilePath});

    // 1. COMPRESSION: Standardize to 720p H.264
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

    // 2. THUMBNAIL: Capture frame at 1s for instant feed loading
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
    
    // 3. PERSISTENCE: Upload back to storage
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
    const finalMediaUrl = `${publicBase}${encodeURIComponent(filePath)}?alt=media`;
    const thumbUrl = `${publicBase}${encodeURIComponent(thumbStoragePath)}?alt=media`;

    const batch = db.batch();
    
    // 4. HANDSHAKE: Update all Pulse posts referencing this file
    const pulseSnap = await db.collection("campus_pulse").where("videoHash", "==", object.metadata?.hash || "").get();
    pulseSnap.forEach(doc => {
      batch.update(doc.ref, { 
        mediaUrl: finalMediaUrl,
        imageUrl: thumbUrl, 
        storageTier: 'hot', 
        storagePath: filePath 
      });
    });

    // 5. DEDUPLICATION: Update central registry
    const fileHash = object.metadata?.hash;
    if (fileHash) {
      const hashRef = db.collection("video_hashes").doc(fileHash);
      batch.set(hashRef, {
        mediaUrl: finalMediaUrl,
        imageUrl: thumbUrl,
        storagePath: filePath,
        storageTier: 'hot',
        processed: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    await batch.commit();

    // Cleanup local temp
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
 * Ensures physical files are only purged when NO more posts reference them.
 */
exports.onPulseDeleted = onDocumentDeleted("campus_pulse/{postId}", async (event) => {
  const post = event.data.data();
  if (!post || post.mediaType !== 'video' || !post.videoHash) return null;

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
      console.log(`Deduplication Safety: Reference preserved. ${newUploads} remaining.`);
    } else {
      // LAST POST: Purge physical file 🧹
      if (data.storagePath) {
        await bucket.file(data.storagePath).delete().catch(() => null);
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
 * Automatically migrates old/inactive vibrations to cheaper storage classes.
 */
exports.manageVideoLifecycle = onSchedule("every 24 hours", async (event) => {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  try {
    // 1. COLD STORAGE MIGRATION (Tier 3: 90% cheaper)
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

    // 2. WARM STORAGE MIGRATION (Tier 2: 50% cheaper)
    const warmSnap = await db.collection("campus_pulse")
      .where("mediaType", "==", "video")
      .where("likes", "<", 10)
      .where("createdAt", "<", thirtyDaysAgo.toISOString())
      .get();

    for (const doc of warmSnap.docs) {
      const data = doc.data();
      if (data.storageTier === 'warm' || data.storageTier === 'cold' || !data.storagePath) continue;
      
      if (data.storagePath.includes("videos/hot/")) {
        const oldPath = data.storagePath;
        const newPath = oldPath.replace("videos/hot/", "videos/warm/");
        
        await bucket.file(oldPath).move(newPath);
        await bucket.file(newPath).setStorageClass("NEARLINE");
        const newUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(newPath)}?alt=media`;
        await doc.ref.update({ mediaUrl: newUrl, storageTier: 'warm', storagePath: newPath });
      }
    }
  } catch (err) {
    console.error("❌ Lifecycle Error:", err);
  }
});
