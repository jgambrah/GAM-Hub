'use client';

/**
 * @fileOverview Hashtag Extraction & Indexing Engine for GAM Hub.
 * Handles the normalization, extraction, and global indexing of campus keywords.
 */

import { doc, setDoc, increment, serverTimestamp, Firestore } from "firebase/firestore";

/**
 * Extracts hashtags from a given text string.
 * - Rules: Alphanumeric and underscores only.
 * - Limit: Max 10 tags per post to prevent spam.
 * - Normalization: All tags converted to lowercase.
 */
export function extractHashtags(text: string): string[] {
  if (!text) return [];

  const regex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.match(regex) || [];

  return matches
    .map(tag => tag.replace('#', '').toLowerCase())
    .filter((tag, index, self) => tag.length > 0 && self.indexOf(tag) === index) // Unique non-empty tags
    .slice(0, 10);
}

/**
 * Updates the global hashtag index in Firestore.
 * This ensures that hashtags are rankable by popularity across the National Hub.
 * 
 * Note: While a Cloud Function also handles this for global consistency,
 * calling this on the client provides immediate local indexing for the current user.
 */
export async function updateHashtagIndex(firestore: Firestore, tags: string[]) {
  if (!firestore || !tags || tags.length === 0) return;

  const promises = tags.map(tag => {
    const ref = doc(firestore, "hashtags", tag.toLowerCase());
    return setDoc(ref, {
      tag: tag.toLowerCase(),
      postCount: increment(1),
      lastUsedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  return Promise.all(promises);
}
