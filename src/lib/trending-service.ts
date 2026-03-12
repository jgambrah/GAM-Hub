
'use client';

import { doc, increment, serverTimestamp, setDoc, Firestore } from 'firebase/firestore';
import type { SocialPost } from './types';

/**
 * 🏎️ THE LIAISON ENGAGEMENT TRACKER
 * Records viral signals to the trending_stats collection for velocity calculation.
 * Now upgraded to track author performance for reputation scoring.
 */
export function recordEngagement(
  firestore: Firestore, 
  postId: string, 
  type: 'view' | 'like' | 'comment' | 'share' | 'completion',
  authorId?: string,
  postCreatedAt?: any
) {
  if (!firestore || !postId) return;

  const ref = doc(firestore, 'trending_stats', postId);
  
  const updates: any = {
    updatedAt: serverTimestamp()
  };

  // 1. Assign Weights based on Liaison Viral Protocol
  if (type === 'view') updates.views = increment(1);
  if (type === 'like') updates.likes = increment(1);
  if (type === 'comment') updates.comments = increment(1);
  if (type === 'share') updates.shares = increment(1);
  if (type === 'completion') updates.completions = increment(1);

  // 2. Persistent Handshake: Ensure the document exists with a creation timestamp and author anchor
  const data: any = { ...updates };
  if (postCreatedAt) data.createdAt = postCreatedAt;
  if (authorId) data.authorId = authorId;

  // Non-blocking write
  setDoc(ref, data, { merge: true }).catch(err => {
    console.warn("Trending Service: Failed to record engagement", err);
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
