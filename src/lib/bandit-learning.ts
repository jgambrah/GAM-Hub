
'use client';

/**
 * @fileOverview Liaison Multi-Armed Bandit Learning Engine.
 * Implements Thompson Sampling to optimize feed strategies based on real engagement.
 *
 * Strategies:
 * A -> 70% personalized / 20% trending / 10% exploration
 * B -> 50% personalized / 40% trending / 10% exploration
 * C -> 60% personalized / 20% trending / 20% exploration
 * D -> 40% personalized / 30% trending / 30% exploration
 */

import { doc, setDoc, increment, Firestore, updateDoc } from 'firebase/firestore';
import { FEED_STRATEGIES, FeedStrategyId } from './feed-strategies';

export interface BanditStrategyStats {
  views: number;
  reward: number;
}

export type GlobalBanditStats = Record<FeedStrategyId, BanditStrategyStats>;

/**
 * selectStrategy
 * --------------
 * Uses Thompson Sampling to pick the optimal "Arm" (Strategy) from global stats.
 * Balances exploitation of high-performers with exploration of potential winners.
 */
export function selectStrategy(stats: GlobalBanditStats): FeedStrategyId {
  let bestStrategy: FeedStrategyId = 'C'; // Default to Balanced Discovery
  let bestSample = -1;

  const strategyIds = Object.keys(FEED_STRATEGIES) as FeedStrategyId[];

  for (const strategyId of strategyIds) {
    const s = stats[strategyId] || { views: 0, reward: 0 };

    // Standard Thompson Parameters: alpha = successes + 1, beta = failures + 1
    const alpha = (s.reward || 0) + 1;
    const beta = Math.max((s.views || 0) - (s.reward || 0) + 1, 1);

    // LIAISON VARIATION: Probability-weighted sampling
    // Thompson sampling usually pulls from Beta distribution, 
    // here we follow the provided spec for Math.random based mean-weighting.
    const sample = Math.random() * (alpha / (alpha + beta));

    if (sample > bestSample) {
      bestSample = sample;
      bestStrategy = strategyId;
    }
  }

  return bestStrategy;
}

/**
 * recordBanditTrial
 * -----------------
 * Logs that a strategy was used to generate a feed (a "trial").
 */
export async function recordBanditTrial(
  firestore: Firestore,
  strategyId: FeedStrategyId
) {
  if (!firestore || !strategyId) return;

  const ref = doc(firestore, 'bandit_stats', 'global');
  return setDoc(ref, {
    [strategyId]: {
      views: increment(1)
    }
  }, { merge: true }).catch(err => {
    console.warn("Bandit Engine: Trial log failed", err);
  });
}

/**
 * recordBanditReward
 * ------------------
 * Logs that a strategy produced a successful engagement.
 * Increments both views and reward to strengthen the success probability.
 */
export async function recordBanditReward(
  firestore: Firestore,
  strategyId: FeedStrategyId
) {
  if (!firestore || !strategyId) return;

  const ref = doc(firestore, 'bandit_stats', 'global');
  
  // Per Liaison Protocol: Engagement is the ultimate success signal
  return updateDoc(ref, {
    [`${strategyId}.views`]: increment(1),
    [`${strategyId}.reward`]: increment(1)
  }).catch(err => {
    console.warn("Bandit Engine: Reward log failed", err);
  });
}

/**
 * REWARD DEFINITION PROTOCOL
 * Triggers that count as a "Reward" for the bandit.
 */
export const BANDIT_REWARDS = new Set([
    'like', 'share', 'comment', 'purchase', 'click', 'intent', 'watch_long'
]);
