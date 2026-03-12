
'use client';

/**
 * @fileOverview Unified User Intelligence Service.
 * Synchronizes social behavior (vibe engagement) and commercial behavior (shopping).
 * Powers the unified recommendation brain of the Yard.
 */

import { doc, setDoc, increment, serverTimestamp, getDoc, Firestore } from 'firebase/firestore';
import type { UserIntelligence, MarketplaceSignal, VibeSignal, SocialPost, Product } from './types';
import { recordEdge } from './knowledge-graph';

// LIAISON INTELLIGENCE WEIGHTS
// Maps signals to their holistic engagement value
const SIGNAL_VALUES: Record<MarketplaceSignal | VibeSignal, number> = {
  // Social Vibrations
  'watch': 1,
  'like': 3,
  'comment': 5,
  'share': 8,
  'reaction': 2,
  'skip': -4, // Negative signal for irrelevance
  
  // Commercial Trade
  'view': 3,
  'click': 6,
  'intent': 10,
  'favorite': 12,
  'purchase': 25, // Strongest possible intent signal
};

/**
 * updateVideoInterest
 * -------------------
 * Updates user interests based on video engagement.
 */
export async function updateVideoInterest(
  firestore: Firestore,
  userId: string,
  post: SocialPost
) {
  if (!firestore || !userId) return;

  const ref = doc(firestore, 'user_intelligence', userId);
  const updates: any = { updatedAt: serverTimestamp() };

  const tags = [...(post.tags || []), ...(post.aiTags || [])];
  tags.forEach(tag => {
    updates[`interests.${tag.toLowerCase()}`] = increment(1);
  });

  // 🕸️ GRAPH HANDSHAKE: Strengthen relationship between tags found in this video
  if (tags.length >= 2) {
      for (let i = 0; i < Math.min(tags.length, 3); i++) {
          for (let j = i + 1; j < Math.min(tags.length, 4); j++) {
              recordEdge(firestore, tags[i].toLowerCase(), tags[j].toLowerCase(), 'tag');
          }
      }
  }

  return setDoc(ref, updates, { merge: true }).catch(() => {});
}

/**
 * updateMarketInterest
 * --------------------
 * Updates user interests based on marketplace behavior.
 */
export async function updateMarketInterest(
  firestore: Firestore,
  userId: string,
  product: Product,
  isPurchase: boolean = false
) {
  if (!firestore || !userId) return;

  const ref = doc(firestore, 'user_intelligence', userId);
  const updates: any = { updatedAt: serverTimestamp() };

  const multiplier = isPurchase ? 3 : 1;

  // 1. Boost Category
  const categoryId = product.category.toLowerCase();
  updates[`interests.${categoryId}`] = increment(3 * multiplier);

  // 2. Boost Tags
  if (product.tags) {
    product.tags.forEach(tag => {
      const tagId = tag.toLowerCase();
      updates[`interests.${tagId}`] = increment(2 * multiplier);
      // 🕸️ GRAPH HANDSHAKE: Link category to its tags
      recordEdge(firestore, categoryId, tagId, 'category', 2);
    });
  }

  // 3. Update Price preference
  if (product.price) {
      const min = product.price * 0.7;
      const max = product.price * 1.5;
      updates.pricePreference = { min, max };
  }

  return setDoc(ref, updates, { merge: true }).catch(() => {});
}

/**
 * recordUnifiedSignal
 */
export async function recordUnifiedSignal(
  firestore: Firestore,
  userId: string,
  type: MarketplaceSignal | VibeSignal,
  context: { 
    tags?: string[], 
    category?: string, 
    creatorId?: string, 
    vendorId?: string,
    price?: number 
  }
) {
  if (!firestore || !userId) return;

  const score = SIGNAL_VALUES[type] || 1;
  const intelRef = doc(firestore, 'user_intelligence', userId);
  
  const updates: any = {
    updatedAt: serverTimestamp(),
    engagementLevel: increment(score * 0.001) 
  };

  const interestsToBoost = new Set<string>();
  if (context.category) interestsToBoost.add(context.category.toLowerCase());
  if (context.tags) context.tags.forEach(t => interestsToBoost.add(t.toLowerCase()));

  interestsToBoost.forEach(interest => {
    let weight = score;
    if (type === 'watch') weight = 1; 
    updates[`interests.${interest}`] = increment(weight);
  });

  if (context.creatorId) {
    updates[`affinities.creators.${context.creatorId}`] = increment(score);
  }
  if (context.vendorId) {
    updates[`affinities.vendors.${context.vendorId}`] = increment(score);
  }

  if (context.price && (type === 'view' || type === 'purchase')) {
      const min = context.price * 0.6;
      const max = context.price * 1.8;
      updates.pricePreference = { min, max };
  }

  try {
    await setDoc(intelRef, updates, { merge: true });
  } catch (err) {
    console.warn("Liaison Intelligence: Profile sync failed", err);
  }
}

/**
 * getUnifiedProfile
 */
export async function getUnifiedProfile(firestore: Firestore, userId: string): Promise<UserIntelligence | null> {
  if (!firestore || !userId) return null;
  const snap = await getDoc(doc(firestore, 'user_intelligence', userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } as UserIntelligence : null;
}
