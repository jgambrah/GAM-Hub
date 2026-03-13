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
   * For HLS, this fetches the master manifest (.m3u8) and initial segments (.ts).
   */
  public preload(post: SocialPost) {
    if (typeof window === 'undefined') return;
    
    const url = post.hlsUrl || post.mediaUrl;
    if (!url || (post.mediaType !== 'video' && post.mediaType !== 'native')) return;
    if (this.buffer.has(post.id)) return;

    // 🏗️ EVICTION PROTOCOL: Prevent memory leaks by capping buffer size
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

    // 📡 PREFETCH HANDSHAKE
    // Creating a detached video element triggers the browser's lookahead prefetch.
    const video = document.createElement("video");
    video.style.display = "none";
    video.preload = "auto";
    video.muted = true;
    
    // Setting src triggers the prefetch of the manifest and first fragments.
    video.src = url;
    video.load();

    this.buffer.set(post.id, video);
    console.log(`📡 Liaison Buffer: Pre-buffered vibe ${post.id.slice(-6)} (${post.mediaType})`);
  }

  /**
   * clear
   * -----
   * Full cache wipe for session resets or identity switches.
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
