'use client';

import type { SocialPost } from "./types";

/**
 * 🎨 SMART FEED DIVERSIFY ENGINE - ENTERPRISE EDITION
 * 
 * Final stage filtering to prevent the "Repetition Trap".
 * Enforces strict variety across creators and topic clusters.
 * 
 * Rules:
 * - maxVideosPerCreator = 2 (per sliding window)
 * - maxVideosPerTopic = 3 (per sliding window)
 */
export function enforceDiversity(posts: SocialPost[], windowSize = 100): SocialPost[] {
  if (!posts || posts.length === 0) return [];

  const result: SocialPost[] = [];
  const pool = [...posts];
  
  // Session-level frequency trackers
  const creatorCount = new Map<string, number>();
  const tagCount = new Map<string, number>();
  const lastCreatorPositions = new Map<string, number>();
  
  // Strict Variety Thresholds
  const MAX_PER_CREATOR = 2; 
  const MAX_PER_TAG_CLUSTER = 3;
  const MIN_CREATOR_GAP = 4; // Force at least 4 items between same creator

  let currentIndex = 0;

  while (pool.length > 0 && result.length < windowSize) {
    let bestIdx = -1;
    
    // Look ahead in the ranked pool for the best diverse candidate
    for (let i = 0; i < Math.min(pool.length, 40); i++) {
      const p = pool[i];
      const creatorId = p.authorId;
      const mainTag = (p.tags?.[0] || 'untagged').toLowerCase();

      const cCount = creatorCount.get(creatorId) || 0;
      const tCount = tagCount.get(mainTag) || 0;
      const lastPos = lastCreatorPositions.get(creatorId);

      const satisfiesCreatorLimit = cCount < MAX_PER_CREATOR;
      const satisfiesTagLimit = tCount < MAX_PER_TAG_CLUSTER;
      const satisfiesGap = lastPos === undefined || (currentIndex - lastPos >= MIN_CREATOR_GAP);

      // Rule: Every 10th slot is an "Exploration Slot" - purposefully bypass top rank
      const isExplorationSlot = (result.length + 1) % 10 === 0;
      if (isExplorationSlot && i < 5 && pool.length > 20) continue;

      if (satisfiesCreatorLimit && satisfiesTagLimit && satisfiesGap) {
        bestIdx = i;
        break;
      }
    }

    // FALLBACK: If no candidate satisfies the strict diversity protocol, 
    // grab the top of the pool to keep the loop moving.
    if (bestIdx === -1) {
      bestIdx = 0;
    }

    const selected = pool.splice(bestIdx, 1)[0];
    result.push(selected);

    // Update trackers
    creatorCount.set(selected.authorId, (creatorCount.get(selected.authorId) || 0) + 1);
    lastCreatorPositions.set(selected.authorId, currentIndex);
    
    const tag = (selected.tags?.[0] || 'untagged').toLowerCase();
    tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
    
    currentIndex++;
  }

  return result;
}
