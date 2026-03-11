'use client';

import { doc, increment, serverTimestamp, setDoc, Firestore } from 'firebase/firestore';

/**
 * 🏎️ THE LIAISON ENGAGEMENT TRACKER
 * Records viral signals to the trending_stats collection for velocity calculation.
 */
export function recordEngagement(
  firestore: Firestore, 
  postId: string, 
  type: 'view' | 'like' | 'comment' | 'share' | 'completion',
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
  if (type === 'completion') updates.completedViews = increment(1);

  // 2. Persistent Handshake: Ensure the document exists with a creation timestamp
  const data: any = { ...updates };
  if (postCreatedAt) {
    data.createdAt = postCreatedAt;
  }

  // Non-blocking write
  setDoc(ref, data, { merge: true }).catch(err => {
    console.warn("Trending Service: Failed to record engagement", err);
  });
}
