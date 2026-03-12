
'use client';

/**
 * @fileOverview Unified User Intelligence Service.
 * Synchronizes social behavior (vibe engagement) and commercial behavior (shopping).
 * Powers the unified recommendation brain of the Yard.
 */

import { doc, setDoc, increment, serverTimestamp, getDoc, Firestore } from 'firebase/firestore';
import type { UserIntelligence, MarketplaceSignal, VibeSignal, SocialPost, Product } from './types';

// LIAISON INTELLIGENCE WEIGHTS
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
  'purchase': 25, // Strongest possible intent
};

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
    updates[`interests.${interest}`] = increment(score);
  });

  // 2. Process Affinities (Creators/Vendors)
  if (context.creatorId) {
    updates[`affinities.creators.${context.creatorId}`] = increment(score);
  }
  if (context.vendorId) {
    updates[`affinities.vendors.${context.vendorId}`] = increment(score);
  }

  // 3. Process Price Sensitivity (Purchases/Views)
  if (context.price && (type === 'view' || type === 'purchase')) {
    // Dynamically adjust price preference min/max based on behavior
    // This is handled via a merge so we don't overwrite if existing
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
