
/**
 * @fileOverview Multi-Armed Bandit (MAB) Feed Strategy Definitions.
 * Each strategy represents an "Arm" in the bandit algorithm.
 * The system will learn which ratio of content types maximizes user engagement.
 */

export const FEED_STRATEGIES = {
  A: {
    personalized: 0.7,
    trending: 0.2,
    explore: 0.1,
    label: "Conservative Personalization"
  },

  B: {
    personalized: 0.5,
    trending: 0.4,
    explore: 0.1,
    label: "Trend Heavy"
  },

  C: {
    personalized: 0.6,
    trending: 0.2,
    explore: 0.2,
    label: "Balanced Discovery"
  },

  D: {
    personalized: 0.4,
    trending: 0.3,
    explore: 0.3,
    label: "Aggressive Exploration"
  }
} as const;

export type FeedStrategyId = keyof typeof FEED_STRATEGIES;

/**
 * Default strategy for new users before enough data is collected.
 */
export const DEFAULT_STRATEGY: FeedStrategyId = 'C';
