
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
 * 🎥 HLS & COMPRESSION ENGINE
 * Processes raw uploads into HLS adaptive segments and optimized MP4 fallbacks.
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
  
  // Guard: Support both Pulse vibrations and Marketplace demos
  const isEligiblePath = filePath.startsWith("videos/hot/") || filePath.startsWith("product_videos/");
  if (!isEligiblePath || filePath.includes("/hls/")) return null;
  
  // Guard: Prevent infinite loops
  if (object.metadata && object.metadata.processed === "true") return null;

  const fileName = path.basename(filePath);
  const fileHash = object.metadata?.hash || fileName.split(".")[0];
  const tempDir = path.join(os.tmpdir(), fileHash);
  
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  const tempFilePath = path.join(os.tmpdir(), fileName);
  const targetFilePath = path.join(os.tmpdir(), `compressed-${fileName}`);
  const thumbFileName = `thumb-${fileHash}.jpg`;
  const thumbTempPath = path.join(os.tmpdir(), thumbFileName);
  
  // HLS Config
  const hlsPlaylistName = "playlist.m3u8";
  const hlsOutputDir = path.join(tempDir, "hls");
  if (!fs.existsSync(hlsOutputDir)) fs.mkdirSync(hlsOutputDir);

  try {
    await bucket.file(filePath).download({destination: tempFilePath});

    // 1. COMPRESSION: Standardize to 720p H.264 MP4 (Fallback)
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

    // 2. HLS TRANSCODING: Generate .m3u8 and .ts segments (6s chunks)
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

    // 3. THUMBNAIL: Capture frame at 1s for instant feed loading
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
    
    // 4. PERSISTENCE: Upload fallback, thumb, and HLS segments
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

    // Batch Upload HLS Playlist and Segments with proper Content-Types for CDN
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
    
    // 5. HANDSHAKE: Update all Pulse posts referencing this file
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

    // 6. DEDUPLICATION: Update central registry
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

    // Cleanup local temp
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
 * 🛡️ DEDUPLICATION-SAFE DELETION TRIGGER
 * Ensures physical files are only removed when NO posts reference them.
 * Cleans up HLS directory, MP4 fallback, and thumbnails.
 */
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
      console.log(`Deduplication Safety: Reference preserved. ${newUploads} remaining.`);
    } else {
      // LAST POST: Purge physical files 🧹
      if (data.storagePath) {
        await bucket.file(data.storagePath).delete().catch(() => null);
        const thumbPath = `videos/thumbs/thumb-${post.videoHash}.jpg`;
        await bucket.file(thumbPath).delete().catch(() => null);
        
        // Delete HLS directory recursively
        await bucket.deleteFiles({ prefix: `videos/hls/${post.videoHash}/` }).catch(() => null);
      }
      transaction.delete(hashRef);
      console.log(`Deduplication Purge: Physical files for hash ${post.videoHash} removed.`);
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
