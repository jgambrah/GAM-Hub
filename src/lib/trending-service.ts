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
  const minuteBucket = new Date().toISOString().slice(0, 16); 
  const velocityRef = doc(firestore, 'post_velocity', postId, 'minutes', minuteBucket);

  const updates: any = {
    updatedAt: serverTimestamp()
  };

  // 1. Assign Weights based on Liaison Engagement Protocol
  // Higher weights for more committed actions
  if (type === 'view') updates.views = increment(1);
  if (type === 'like') updates.likes = increment(2);
  if (type === 'comment') updates.comments = increment(3);
  if (type === 'share') updates.shares = increment(5);
  if (type === 'completion') updates.completions = increment(10);

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
 */
export async function promoteToTrending(firestore: Firestore, post: SocialPost) {
  if (!firestore || !post.id) return;
  const ref = doc(firestore, 'trending_stats', post.id);
  
  await setDoc(ref, {
    authorId: post.authorId,
    trendScore: 50, // High base score for immediate promotion
    manualPromotion: true,
    updatedAt: serverTimestamp(),
    createdAt: post.createdAt
  }, { merge: true });
}
