'use client';

/**
 * @fileOverview Liaison Video Buffer Manager.
 * Orchestrates TikTok-style prefetching for the Yard.
 * Maintains a pool of pre-loaded video elements to ensure instant playback.
 * 
 * Refinement: Implements Smart Prefetch Cancellation and memory safe-guards.
 */

import type { SocialPost } from "./types";

class VibeBufferManager {
  private buffer = new Map<string, HTMLVideoElement>();
  private maxBufferSize = 5; // LIAISON PROTOCOL: Window for fast-scrolling lookahead

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
        this.cleanup(oldestId);
      }
    }

    // 📡 PREFETCH HANDSHAKE
    try {
      const video = document.createElement("video");
      video.style.display = "none";
      video.preload = "auto";
      video.muted = true;
      
      // Setting src triggers the prefetch of the manifest and first fragments.
      video.src = url;
      video.load();

      this.buffer.set(post.id, video);
      console.log(`📡 Liaison Buffer: Pre-buffered vibe ${post.id.slice(-6)}`);
    } catch (e) {
      console.warn("Liaison Buffer: Prefetch handshake failed.", e);
    }
  }

  /**
   * maintain
   * --------
   * SMART CANCELLATION: Evicts and cancels downloads for any video not in the active window.
   * Call this when the user's position in the feed changes.
   */
  public maintain(activeIds: string[]) {
    const currentBufferedIds = Array.from(this.buffer.keys());
    currentBufferedIds.forEach(id => {
      if (!activeIds.includes(id)) {
        this.cleanup(id);
      }
    });
  }

  /**
   * cleanup
   * -------
   * Forces the browser to release resources and ABORT pending downloads.
   */
  private cleanup(id: string) {
    const el = this.buffer.get(id);
    if (el) {
      // CRITICAL: Setting src to empty and calling load() is the only 
      // reliable way to force the browser to stop the download and free memory.
      el.pause();
      el.src = "";
      el.load(); 
      el.remove();
      this.buffer.delete(id);
      console.log(`🧹 Liaison Buffer: Cancelled/Evicted vibe ${id.slice(-6)} to save bandwidth.`);
    }
  }

  /**
   * clear
   * -----
   * Full cache wipe for session resets.
   */
  public clear() {
    const ids = Array.from(this.buffer.keys());
    ids.forEach(id => this.cleanup(id));
    this.buffer.clear();
  }
}

export const vibeBufferManager = new VibeBufferManager();
