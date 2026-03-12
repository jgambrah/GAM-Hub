'use client';

import type { SocialPost } from "./types";

/**
 * 🎨 SMART FEED DIVERSITY ENGINE
 * 
 * Final stage filtering to prevent the "Repetition Trap".
 * Enforces balance across creators, topics, and media types.
 */
export function enforceDiversity(posts: SocialPost[], windowSize = 12): SocialPost[] {
  if (!posts || posts.length === 0) return [];

  const result: SocialPost[] = [];
  const pool = [...posts];
  
  // Trackers for the current sliding window
  const seenCreators = new Map<string, number>();
  const seenTags = new Map<string, number>();
  const seenTypes = new Map<string, number>();

  // Professional Thresholds
  const MAX_PER_CREATOR = 2;
  const MAX_PER_TAG = 3;
  const MAX_PER_TYPE = 4;

  while (pool.length > 0) {
    let bestIdx = 0; // Default to top-ranked
    
    // Scan pool for the highest-ranked post that satisfies diversity
    for (let i = 0; i < Math.min(pool.length, 20); i++) {
      const p = pool[i];
      const creatorCount = seenCreators.get(p.authorId) || 0;
      const primaryTag = (p.tags?.[0] || 'untagged').toLowerCase();
      const tagCount = seenTags.get(primaryTag) || 0;
      const typeCount = seenTypes.get(p.mediaType || 'text') || 0;

      // Constraint Checks
      const violatesCreator = creatorCount >= MAX_PER_CREATOR;
      const violatesTag = tagCount >= MAX_PER_TAG;
      const violatesType = typeCount >= MAX_PER_TYPE;

      // 🛰️ EXPLORATION SLOT: Every 6th post, skip the top match to surface something different
      const isExplorationSlot = (result.length + 1) % 6 === 0;
      
      if (isExplorationSlot) {
          // Looking for a 'Good enough' post that isn't the current top one
          if (!violatesCreator && !violatesTag && i > 0) {
              bestIdx = i;
              break;
          }
      } else if (!violatesCreator && !violatesTag && !violatesType) {
        bestIdx = i;
        break;
      }
    }

    const selected = pool.splice(bestIdx, 1)[0];
    result.push(selected);

    // Update trackers for the current window
    seenCreators.set(selected.authorId, (seenCreators.get(selected.authorId) || 0) + 1);
    const tag = (selected.tags?.[0] || 'untagged').toLowerCase();
    seenTags.set(tag, (seenTags.get(tag) || 0) + 1);
    seenTypes.set(selected.mediaType || 'text', (seenTypes.get(selected.mediaType || 'text') || 0) + 1);

    // Sliding window reset: Keep the feed moving
    if (result.length % windowSize === 0) {
      seenCreators.clear();
      seenTags.clear();
      seenTypes.clear();
    }
  }

  return result;
}
