'use client';

/**
 * @fileOverview Enterprise-Grade Hashtag Engine for GAM Hub.
 * Handles extraction, anti-spam validation, indexing, graph relationships, and rendering.
 */

import { doc, setDoc, increment, serverTimestamp, Firestore, query, collection, orderBy, startAt, endAt, getDocs, limit, writeBatch } from "firebase/firestore";
import React from 'react';
import Link from 'next/link';

// LIAISON BLACKLIST: Prevent toxic or manipulative indexing
const BANNED_TAGS = new Set(['spam', 'scam', 'cheat', 'hack', 'violence']);

/**
 * Extracts hashtags from a given text string with professional constraints.
 */
export function extractHashtags(text: string): string[] {
  if (!text) return [];

  // Regex captures # followed by alphanumeric/underscore
  const regex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.match(regex) || [];

  return matches
    .map(tag => tag.replace('#', '').toLowerCase())
    .filter((tag, index, self) => (
        tag.length > 0 && 
        tag.length <= 25 && // Anti-spam: Length limit
        self.indexOf(tag) === index && // Deduplication
        !BANNED_TAGS.has(tag) // Security: Blacklist check
    ))
    .slice(0, 10); // Policy: Max 10 tags per vibration
}

/**
 * Updates the global hashtag index in Firestore.
 */
export async function updateHashtagIndex(firestore: Firestore, tags: string[]) {
  if (!firestore || !tags || tags.length === 0) return;

  // Use parallel setDocs for zero-latency indexing
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

/**
 * Updates the Hashtag Graph by mapping co-occurrence between tags.
 * This allows the system to learn that #afrobeats is related to #amapiano.
 */
export async function updateHashtagGraph(firestore: Firestore, tags: string[]) {
  if (!firestore || !tags || tags.length < 2) return;

  const batch = writeBatch(firestore);
  const normalizedTags = tags.map(t => t.toLowerCase());

  // Iterate through every unique pair of tags
  for (let i = 0; i < normalizedTags.length; i++) {
    for (let j = i + 1; j < normalizedTags.length; j++) {
      const tagA = normalizedTags[i];
      const tagB = normalizedTags[j];

      // Map relationship A -> B
      const refA = doc(firestore, "hashtagGraph", tagA, "edges", tagB);
      batch.set(refA, {
        tag: tagB,
        weight: increment(1),
        lastConnectedAt: serverTimestamp()
      }, { merge: true });

      // Map relationship B -> A (Bidirectional for easy lookup)
      const refB = doc(firestore, "hashtagGraph", tagB, "edges", tagA);
      batch.set(refB, {
        tag: tagA,
        weight: increment(1),
        lastConnectedAt: serverTimestamp()
      }, { merge: true });
    }
  }

  try {
    await batch.commit();
  } catch (err) {
    console.error("Liaison Graph Error: Failed to update hashtag relationships:", err);
  }
}

/**
 * Searches for hashtags by prefix for autocomplete.
 */
export async function searchHashtags(firestore: Firestore, prefix: string) {
  const cleanPrefix = prefix.startsWith('#') ? prefix.slice(1).toLowerCase() : prefix.toLowerCase();
  if (!cleanPrefix) return [];

  const q = query(
    collection(firestore, "hashtags"),
    // Ordered by trendScore to show velocity-based suggestions first
    orderBy("tag"), 
    startAt(cleanPrefix),
    endAt(cleanPrefix + "\uf8ff"),
    limit(5)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

/**
 * Renders text with clickable hashtags linked to the hashtag feed.
 */
export function renderWithHashtags(text: string) {
  if (!text) return null;

  const parts = text.split(/(#\w+)/g);
  
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      const tag = part.slice(1).toLowerCase();
      if (BANNED_TAGS.has(tag)) return part; // Don't link banned tags

      return React.createElement(Link, {
        key: i,
        href: `/hashtag/${tag}`,
        className: "text-blue-500 hover:underline font-black",
        onClick: (e: any) => e.stopPropagation()
      }, part);
    }
    return part;
  });
}
