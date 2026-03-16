import type { SocialPost, UserIntelligence, VibeMood } from './types';
import { cosineSimilarity } from './utils';

/**
 * computeVibeScore
 * ----------------
 * Professional ranking algorithm combining Personalization, Trends, and Neural Similarity.
 * Now expanded with Step 5: Paid Highlight Promotion Prioritization.
 */
export function computeVibeScore(
  candidate: SocialPost,
  context: {
    currentPost?: SocialPost | null;
    queryVector?: number[] | null;
    userIntelligence?: Partial<UserIntelligence> | null;
    globalTrendScores: Record<string, number>;
    activeMood: VibeMood;
    getPersonalScore: (p: SocialPost) => number;
  }
) {
  let score = 0;
  const { currentPost, queryVector, userIntelligence, globalTrendScores, getPersonalScore } = context;

  // 1. 🚀 STEP 5: PAID PROMOTION BOOST (Highest Priority)
  // If a creator has paid to boost, they jump the queue.
  if (candidate.isPromoted && candidate.promotionViewsTarget) {
      const delivered = candidate.promotionViewsDelivered || 0;
      const target = candidate.promotionViewsTarget;
      
      // Only boost if target hasn't been met
      if (delivered < target) {
          const tier = candidate.promotionLevel || 'small';
          // Massive bonuses to ensure promoted content surfaces instantly
          const tierBonus = tier === 'large' ? 1000 : tier === 'medium' ? 600 : 300;
          
          // Apply a "Urgency Multiplier" - stronger boost if we are far from target
          const progress = delivered / target;
          const urgencyMultiplier = progress < 0.5 ? 1.5 : 1.0;
          
          score += tierBonus * urgencyMultiplier;

          // 🏆 LIAISON PROTOCOL: 4x Multiplier for Paid Visibility
          // This ensures boosted content significantly outranks even the strongest organic vibes.
          score *= 4;
      }
  }

  // 2. 🧠 NEURAL SEARCH: Match search query vector to post embedding (Primary discovery)
  if (queryVector && candidate.embedding) {
    const similarity = cosineSimilarity(queryVector, candidate.embedding);
    if (similarity > 0.7) {
      score += similarity * 100; // Strongest signal for active search
    }
  }

  // 3. 🔗 SEMANTIC SIMILARITY: Find "Related Videos" (Autoplay logic)
  if (currentPost?.embedding && candidate.embedding) {
    const similarity = cosineSimilarity(currentPost.embedding, candidate.embedding);
    if (similarity > 0.8) {
      score += similarity * 40; 
    }
  }

  // 4. 🎯 PERSONALIZATION: Match to long-term User Taste Vector
  if (userIntelligence?.tasteVector && candidate.embedding) {
    const similarity = cosineSimilarity(userIntelligence.tasteVector, candidate.embedding);
    if (similarity > 0.8) {
      score += similarity * 30;
    }
  }

  // 5. 📈 TREND BOOST: Global momentum (5x Weight)
  const globalTrendValue = globalTrendScores[candidate.id] || 0;
  score += globalTrendValue * 5;

  // 6. 🏗️ ENGAGEMENT: Native metrics
  const engagementScore = (candidate.likes || 0) * 2 + (candidate.commentCount || 0) * 3;
  score += Math.min(engagementScore, 50);

  // 7. 🌍 FRESHNESS DECAY
  if (candidate.createdAt) {
    const date = new Date(candidate.createdAt);
    const ageHours = (Date.now() - date.getTime()) / 3600000;
    score *= Math.exp(-ageHours / 24);
  }

  return score;
}
