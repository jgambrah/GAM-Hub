'use client';

import type { SocialPost } from "./types";

/**
 * 🎨 SMART FEED DIVERSITY ENGINE - PRO EDITION
 * 
 * Final stage filtering to prevent the "Repetition Trap".
 * Enforces balance across creators, topics (tags), and media types.
 * This runs after the AI ranking engine has produced a sorted list.
 */
export function enforceDiversity(posts: SocialPost[], windowSize = 30): SocialPost[] {
  if (!posts || posts.length === 0) return [];

  const result: SocialPost[] = [];
  const pool = [...posts];
  
  // Trackers for the current selection session
  const creatorCount = new Map<string, number>();
  const lastCreatorPositions = new Map<string, number>();
  const tagCount = new Map<string, number>();
  const typeCount = new Map<string, number>();

  // Professional Thresholds
  const MAX_PER_CREATOR = 3;
  const MIN_CREATOR_GAP = 4; // Prevent one creator from dominating
  const MAX_PER_TAG = 3;
  const MAX_PER_TYPE = 5;

  let currentIndex = 0;

  while (pool.length > 0 && result.length < windowSize) {
    let bestIdx = -1;
    
    // Scan pool for the highest-ranked post that satisfies diversity
    for (let i = 0; i < Math.min(pool.length, 40); i++) {
      const p = pool[i];
      const creatorId = p.authorId;
      const mainTag = (p.tags?.[0] || 'untagged').toLowerCase();
      const mediaType = p.mediaType || 'text';

      const cCount = creatorCount.get(creatorId) || 0;
      const tCount = tagCount.get(mainTag) || 0;
      const typeC = typeCount.get(mediaType) || 0;
      
      const lastPos = lastCreatorPositions.get(creatorId);
      const satisfiesGap = lastPos === undefined || (currentIndex - lastPos >= MIN_CREATOR_GAP);

      // 🛰️ EXPLORATION SLOT: Every 6th post, we skip the top matches 
      // to surface something different from deeper in the pool.
      const isExplorationSlot = (result.length + 1) % 6 === 0;
      
      if (isExplorationSlot && i < 5 && pool.length > 15) {
          // Force exploration by skipping the absolute top matches
          continue;
      }

      // Check Constraints
      const satisfiesCreator = cCount < MAX_PER_CREATOR;
      const satisfiesTag = tCount < MAX_PER_TAG;
      const satisfiesType = typeC < MAX_PER_TYPE;

      if (satisfiesCreator && satisfiesGap && satisfiesTag && satisfiesType) {
        bestIdx = i;
        break;
      }
    }

    // FALLBACK: If no post satisfies constraints, take the top one to keep feed alive
    // but try to avoid absolute repetition if possible
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
    typeCount.set(selected.mediaType || 'text', (typeCount.get(selected.mediaType || 'text') || 0) + 1);
    
    currentIndex++;
  }

  return result;
}
