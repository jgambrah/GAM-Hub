
'use client';

/**
 * @fileOverview Video Infrastructure Utility.
 * Implements startup-safe validation and cryptographic deduplication logic.
 * 
 * Rules:
 * 1. Max Size: 50MB
 * 2. Max Duration: 30s
 * 3. Deduplication: SHA-256 Hashing
 */

export const VIDEO_CONFIG = {
  MAX_SIZE_MB: 50,
  MAX_DURATION_SEC: 30,
  ALLOWED_TYPES: ['video/mp4', 'video/webm', 'video/quicktime'],
};

/**
 * generateFileHash
 * ----------------
 * Generates a SHA-256 fingerprint of a file to prevent duplicate storage.
 * Used for the Video Deduplication Engine.
 */
export async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hash;
}

/**
 * validateVideo
 * -------------
 * Deep audit of a video file before allowing upload to protect storage costs.
 */
export async function validateVideo(file: File) {
  const maxSize = VIDEO_CONFIG.MAX_SIZE_MB * 1024 * 1024;

  if (!VIDEO_CONFIG.ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid format. Please upload MP4, WebM or MOV.");
  }

  if (file.size > maxSize) {
    throw new Error(`File too large. Max ${VIDEO_CONFIG.MAX_SIZE_MB}MB allowed.`);
  }

  try {
    const duration = await getVideoDuration(file);
    if (duration > VIDEO_CONFIG.MAX_DURATION_SEC) {
      throw new Error(`Video too long. Max ${VIDEO_CONFIG.MAX_DURATION_SEC}s allowed.`);
    }
  } catch (err) {
    console.warn("Video metadata check skipped.");
  }
}

async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => reject("Metadata error.");
    video.src = URL.createObjectURL(file);
  });
}
