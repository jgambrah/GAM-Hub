
'use client';

/**
 * @fileOverview Unified User Intelligence Service.
 * Synchronizes social behavior (vibe engagement) and commercial behavior (shopping).
 * Now expanded with Semantic Taste Vector management.
 */

import { doc, setDoc, increment, serverTimestamp, getDoc, Firestore } from 'firebase/firestore';
import type { UserIntelligence, MarketplaceSignal, VibeSignal, SocialPost, Product } from './types';
import { recordEdge } from './knowledge-graph';
import { recordBanditReward, BANDIT_REWARDS } from './bandit-learning';
import type { FeedStrategyId } from './feed-strategies';
import { generateUserEmbedding } from '@/ai/flows/update-user-embedding';

// LIAISON INTELLIGENCE WEIGHTS - REFINED FOR ENGAGEMENT LOOP
const SIGNAL_VALUES: Record<MarketplaceSignal | VibeSignal, number> = {
  'watch': 1,
  'like': 3,
  'comment': 5,
  'share': 8,
  'reaction': 2,
  'skip': -10, 
  'view': 3,
  'click': 6,
  'intent': 10,
  'favorite': 12,
  'purchase': 25, 
};

/**
 * updateVideoInterest
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

  if (tags.length >= 1) {
      tags.slice(0, 5).forEach(tag => {
          recordEdge(firestore, { id: tag.toLowerCase(), type: 'tag' }, { id: post.authorId, type: 'creator' }, 1);
      });
  }

  // 🧠 SEMANTIC REFRESH: Occasionally update the taste vector
  if (Math.random() > 0.8) {
      refreshUserTasteVector(firestore, userId);
  }

  return setDoc(ref, updates, { merge: true }).catch(() => {});
}

/**
 * refreshUserTasteVector
 * ---------------------
 * Converts the user's weighted interests into a neural vector.
 */
export async function refreshUserTasteVector(firestore: Firestore, userId: string) {
    const snap = await getDoc(doc(firestore, 'user_intelligence', userId));
    if (!snap.exists()) return;
    
    const intel = snap.data() as UserIntelligence;
    const topInterests = Object.entries(intel.interests || {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .map(([tag]) => tag);
    
    if (topInterests.length === 0) return;

    try {
        const tasteVector = await generateUserEmbedding(topInterests);
        if (tasteVector) {
            await setDoc(doc(firestore, 'user_intelligence', userId), { 
                tasteVector,
                updatedAt: serverTimestamp() 
            }, { merge: true });
        }
    } catch (e) {
        console.warn("Liaison Taste Vector drift:", e);
    }
}

/**
 * updateMarketInterest
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

  const categoryId = product.category.toLowerCase();
  updates[`interests.${categoryId}`] = increment(3 * multiplier);

  if (product.tags) {
    product.tags.forEach(tag => {
      const tagId = tag.toLowerCase();
      updates[`interests.${tagId}`] = increment(2 * multiplier);
      recordEdge(firestore, { id: categoryId, type: 'category' }, { id: tagId, type: 'tag' }, 2);
    });
  }

  recordEdge(firestore, { id: categoryId, type: 'category' }, { id: product.vendorId, type: 'vendor' }, 2 * multiplier);

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
  },
  currentStrategy?: FeedStrategyId | null
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
    if (type === 'skip') {
        updates[`interests.${interest}`] = increment(-5);
    } else {
        updates[`interests.${interest}`] = increment(score);
    }
  });

  if (context.creatorId) updates[`affinities.creators.${context.creatorId}`] = increment(score);
  if (context.vendorId) updates[`affinities.vendors.${context.vendorId}`] = increment(score);

  if (context.price && (type === 'view' || type === 'purchase')) {
      const min = context.price * 0.6;
      const max = context.price * 1.8;
      updates.pricePreference = { min, max };
  }

  if (currentStrategy && BANDIT_REWARDS.has(type)) {
      recordBanditReward(firestore, currentStrategy);
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
