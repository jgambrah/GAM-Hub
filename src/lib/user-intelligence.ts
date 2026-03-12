
'use client';

/**
 * @fileOverview Unified User Intelligence Service.
 * Synchronizes social behavior (vibe engagement) and commercial behavior (shopping).
 * Powers the unified recommendation brain of the Yard.
 */

import { doc, setDoc, increment, serverTimestamp, getDoc, Firestore } from 'firebase/firestore';
import type { UserIntelligence, MarketplaceSignal, VibeSignal, SocialPost, Product } from './types';

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
 * (Signal: +1 per tag)
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

  return setDoc(ref, updates, { merge: true }).catch(() => {});
}

/**
 * updateMarketInterest
 * --------------------
 * Updates user interests based on marketplace behavior.
 * (Signal: Category +3, Tags +2)
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

  // Purchases have a multiplier effect on the signal (3x)
  const multiplier = isPurchase ? 3 : 1;

  // 1. Boost Category (Primary Signal)
  updates[`interests.${product.category.toLowerCase()}`] = increment(3 * multiplier);

  // 2. Boost Tags (Secondary Signal)
  if (product.tags) {
    product.tags.forEach(tag => {
      updates[`interests.${tag.toLowerCase()}`] = increment(2 * multiplier);
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
 * -------------------
 * The primary entry point for behavior logging.
 * Updates the shared interest profile regardless of the signal's origin.
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
    engagementLevel: increment(score * 0.001) // Normalize level over time
  };

  // 1. Process Tags & Categories (Interests)
  const interestsToBoost = new Set<string>();
  if (context.category) interestsToBoost.add(context.category.toLowerCase());
  if (context.tags) context.tags.forEach(t => interestsToBoost.add(t.toLowerCase()));

  interestsToBoost.forEach(interest => {
    // Determine the interest weight based on the signal origin
    let weight = score;
    if (type === 'watch') weight = 1; // Align with updateVideoInterest protocol
    
    updates[`interests.${interest}`] = increment(weight);
  });

  // 2. Process Affinities (Creators/Vendors)
  if (context.creatorId) {
    updates[`affinities.creators.${context.creatorId}`] = increment(score);
  }
  if (context.vendorId) {
    updates[`affinities.vendors.${context.vendorId}`] = increment(score);
  }

  // 3. Process Price Sensitivity
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
 * -----------------
 * Retrieval for the ranking engines.
 */
export async function getUnifiedProfile(firestore: Firestore, userId: string): Promise<UserIntelligence | null> {
  if (!firestore || !userId) return null;
  const snap = await getDoc(doc(firestore, 'user_intelligence', userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } as UserIntelligence : null;
}
