'use client';

import type { SocialPost } from "./types";

/**
 * 🎨 SMART FEED DIVERSIFY ENGINE - ELITE EDITION
 * 
 * Final stage filtering to prevent the "Repetition Trap".
 * Enforces balance across creators, topics (tags), and media types.
 * 
 * Update: Increased limits to ensure students see more of the pool
 * while still maintaining variety.
 */
export function enforceDiversity(posts: SocialPost[], windowSize = 100): SocialPost[] {
  if (!posts || posts.length === 0) return [];

  const result: SocialPost[] = [];
  const pool = [...posts];
  
  // Trackers for the current selection session
  const creatorCount = new Map<string, number>();
  const lastCreatorPositions = new Map<string, number>();
  const tagCount = new Map<string, number>();
  const typeCount = new Map<string, number>();
  
  // Track consecutive types to prevent streaks
  let consecutiveType = { type: '', count: 0 };

  // Professional Thresholds - Relaxed for better visibility
  const MAX_PER_CREATOR = 6; 
  const MIN_CREATOR_GAP = 3; 
  const MAX_PER_TAG_CLUSTER = 5;
  const MAX_SAME_TYPE_STREAK = 4; 

  let currentIndex = 0;

  while (pool.length > 0 && result.length < windowSize) {
    let bestIdx = -1;
    
    // Scan pool for the highest-ranked post that satisfies diversity
    for (let i = 0; i < Math.min(pool.length, 50); i++) {
      const p = pool[i];
      const creatorId = p.authorId;
      const mainTag = (p.tags?.[0] || 'untagged').toLowerCase();
      const mediaType = p.mediaType || 'text';

      const cCount = creatorCount.get(creatorId) || 0;
      const tCount = tagCount.get(mainTag) || 0;
      
      const lastPos = lastCreatorPositions.get(creatorId);
      const satisfiesGap = lastPos === undefined || (currentIndex - lastPos >= MIN_CREATOR_GAP);

      // 🛰️ EXPLORATION SLOT: Every 8th post (relaxed from 6th), we skip the top matches 
      // to surface something different from deeper in the pool.
      const isExplorationSlot = (result.length + 1) % 8 === 0;
      if (isExplorationSlot && i < 10 && pool.length > 30) {
          continue;
      }

      // Check Constraints
      const satisfiesCreator = cCount < MAX_PER_CREATOR;
      const satisfiesTag = tCount < MAX_PER_TAG_CLUSTER;
      const satisfiesTypeStreak = consecutiveType.type !== mediaType || consecutiveType.count < MAX_SAME_TYPE_STREAK;

      if (satisfiesCreator && satisfiesGap && satisfiesTag && satisfiesTypeStreak) {
        bestIdx = i;
        break;
      }
    }

    // FALLBACK: If no post satisfies constraints, take the top one to keep feed alive
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
    
    // Update type streak
    const type = selected.mediaType || 'text';
    if (consecutiveType.type === type) {
        consecutiveType.count++;
    } else {
        consecutiveType.type = type;
        consecutiveType.count = 1;
    }
    
    currentIndex++;
  }

  return result;
}
