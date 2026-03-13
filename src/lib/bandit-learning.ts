
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

import { doc, setDoc, increment, Firestore, getDoc } from 'firebase/firestore';
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
 * recordBanditSignal
 * ------------------
 * Non-blocking logger for global strategy performance.
 */
export async function recordBanditSignal(
  firestore: Firestore,
  strategyId: FeedStrategyId,
  type: 'view' | 'reward'
) {
  if (!firestore || !strategyId) return;

  const ref = doc(firestore, 'bandit_stats', 'global');
  const update: any = {};
  update[`${strategyId}.${type === 'view' ? 'views' : 'reward'}`] = increment(1);
  
  return setDoc(ref, update, { merge: true }).catch(err => {
    console.warn("Bandit Engine: Signal log failed", err);
  });
}

/**
 * REWARD DEFINITION PROTOCOL
 */
export const BANDIT_REWARDS = new Set([
    'like', 'share', 'comment', 'purchase', 'click', 'intent', 'watch_long'
]);
