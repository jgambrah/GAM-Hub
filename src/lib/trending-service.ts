
'use client';

import { doc, increment, serverTimestamp, setDoc, Firestore } from 'firebase/firestore';
import type { SocialPost } from './types';

/**
 * 🏎️ THE LIAISON TREND DETECTION ENGINE
 * Records viral signals to both aggregate stats and time-series minute buckets.
 */
export function recordEngagement(
  firestore: Firestore, 
  postId: string, 
  type: 'view' | 'like' | 'comment' | 'share' | 'completion',
  authorId?: string,
  postCreatedAt?: any
) {
  if (!firestore || !postId) return;

  const statsRef = doc(firestore, 'trending_stats', postId);
  
  // 🕒 MINUTE BUCKET LOGIC: Detects velocity within a 60-second window
  const minuteBucket = new Date().toISOString().slice(0, 16); // e.g., "2026-03-12T15:20"
  const velocityRef = doc(firestore, 'post_velocity', postId, 'minutes', minuteBucket);

  const updates: any = {
    updatedAt: serverTimestamp()
  };

  // 1. Assign Weights based on Liaison Viral Protocol
  if (type === 'view') updates.views = increment(1);
  if (type === 'like') updates.likes = increment(1);
  if (type === 'comment') updates.comments = increment(1);
  if (type === 'share') updates.shares = increment(1);
  if (type === 'completion') updates.completions = increment(1);

  // 2. Persistent Handshake: Update Global Aggregate
  const statsData: any = { ...updates };
  if (postCreatedAt) statsData.createdAt = postCreatedAt;
  if (authorId) statsData.authorId = authorId;

  // Non-blocking write to aggregate
  setDoc(statsRef, statsData, { merge: true }).catch(err => {
    console.warn("Trending Service: Failed to record global stats", err);
  });

  // 3. Time-Series Velocity Write: Record specifically for THIS minute
  const velocityData: any = { ...updates };
  setDoc(velocityRef, velocityData, { merge: true }).catch(err => {
    console.warn("Trending Service: Failed to record velocity bucket", err);
  });
}

/**
 * 🎓 VIRAL GRADUATION
 * Manually promotes a successful vibration into the trending pool.
 */
export async function promoteToTrending(firestore: Firestore, post: SocialPost) {
  if (!firestore || !post.id) return;
  const ref = doc(firestore, 'trending_stats', post.id);
  
  await setDoc(ref, {
    authorId: post.authorId,
    trendScore: 50, // High base score for promotion
    manualPromotion: true,
    updatedAt: serverTimestamp(),
    createdAt: post.createdAt
  }, { merge: true });
}
