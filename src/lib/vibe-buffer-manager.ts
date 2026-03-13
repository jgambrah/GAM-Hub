'use client';

/**
 * @fileOverview Liaison Video Buffer Manager.
 * Orchestrates TikTok-style prefetching for the Yard.
 * Maintains a pool of pre-loaded video elements to ensure instant playback.
 */

import type { SocialPost } from "./types";

class VibeBufferManager {
  private buffer = new Map<string, HTMLVideoElement>();
  private maxBufferSize = 5;

  /**
   * preload
   * -------
   * Hiddenly loads the next vibration into the browser's memory/disk cache.
   */
  public preload(post: SocialPost) {
    if (typeof window === 'undefined') return;
    
    const url = post.hlsUrl || post.mediaUrl;
    if (!url || (post.mediaType !== 'video' && post.mediaType !== 'native')) return;
    if (this.buffer.has(post.id)) return;

    // Evict oldest if buffer is full to prevent memory leaks
    if (this.buffer.size >= this.maxBufferSize) {
      const oldestId = this.buffer.keys().next().value;
      if (oldestId) {
        const el = this.buffer.get(oldestId);
        if (el) {
          el.src = "";
          el.load(); // Forces browser to release resources
        }
        this.buffer.delete(oldestId);
      }
    }

    const video = document.createElement("video");
    video.style.display = "none";
    video.preload = "auto";
    video.muted = true;
    
    // Setting src triggers the browser's prefetch mechanism.
    // For HLS, this will cache the master manifest and initial segments.
    video.src = url;
    video.load();

    this.buffer.set(post.id, video);
    console.log(`📡 Liaison Buffer: Prefetching vibration ${post.id} (${post.mediaType})`);
  }

  /**
   * clear
   * -----
   * Full cache wipe for session resets.
   */
  public clear() {
    this.buffer.forEach(el => {
      el.src = "";
      el.load();
    });
    this.buffer.clear();
  }
}

export const vibeBufferManager = new VibeBufferManager();
