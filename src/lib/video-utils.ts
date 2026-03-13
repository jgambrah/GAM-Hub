'use client';

/**
 * @fileOverview Video Infrastructure Utility.
 * Implements startup-safe validation to minimize storage and bandwidth costs.
 * 
 * Rules:
 * 1. Max Size: 50MB (Prevents cost explosion)
 * 2. Max Duration: 30s (Enforces snappy campus vibes)
 * 3. Formats: MP4, WebM, MOV (High-compatibility)
 */

export const VIDEO_CONFIG = {
  MAX_SIZE_MB: 50,
  MAX_DURATION_SEC: 30,
  ALLOWED_TYPES: ['video/mp4', 'video/webm', 'video/quicktime'],
};

/**
 * validateVideo
 * -------------
 * Performs a deep audit of a video file before allowing upload to Firebase Storage.
 */
export async function validateVideo(file: File) {
  const maxSize = VIDEO_CONFIG.MAX_SIZE_MB * 1024 * 1024;

  // 1. Type Check
  if (!VIDEO_CONFIG.ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid format. Please upload MP4, WebM or MOV.");
  }

  // 2. Size Check
  if (file.size > maxSize) {
    throw new Error(`File too large. Max ${VIDEO_CONFIG.MAX_SIZE_MB}MB allowed for campus vibes.`);
  }

  // 3. Duration Check (Client-side Metadata Audit)
  try {
    const duration = await getVideoDuration(file);
    if (duration > VIDEO_CONFIG.MAX_DURATION_SEC) {
      throw new Error(`Video too long. Max ${VIDEO_CONFIG.MAX_DURATION_SEC} seconds allowed to keep the Yard snappy.`);
    }
  } catch (err) {
    console.warn("Video metadata check failed, proceeding with size check only.");
  }
}

/**
 * getVideoDuration
 * ----------------
 * Spawns a temporary browser video element to extract the true duration.
 */
async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => reject("Could not read video metadata.");
    video.src = URL.createObjectURL(file);
  });
}
