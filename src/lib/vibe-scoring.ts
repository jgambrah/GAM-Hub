
import type { SocialPost, UserIntelligence, VibeMood } from './types';
import { cosineSimilarity } from './utils';

/**
 * computeVibeScore
 * ----------------
 * Professional ranking algorithm combining Personalization, Trends, and Neural Similarity.
 * Now overhauled to provide high-impact results for Search Discovery.
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

  // 1. 🧠 SEARCH INTELLIGENCE (Primary Override)
  // If a neural vector from a search query is present, it becomes the dominant ranking factor.
  if (queryVector && candidate.embedding) {
    const similarity = cosineSimilarity(queryVector, candidate.embedding);
    // Exponential boost for high-similarity neural matches
    if (similarity > 0.6) {
      score += Math.pow(similarity, 2) * 200; 
    }
  }

  // 2. 🚀 PAID PROMOTION BOOST
  // If a creator has paid to boost, they jump the queue.
  if (candidate.isPromoted && candidate.promotionViewsTarget) {
      const delivered = candidate.promotionViewsDelivered || 0;
      const target = candidate.promotionViewsTarget;
      
      if (delivered < target) {
          const tier = candidate.promotionLevel || 'small';
          const tierBonus = tier === 'large' ? 1000 : tier === 'medium' ? 600 : 300;
          
          const progress = delivered / target;
          const urgencyMultiplier = progress < 0.5 ? 1.5 : 1.0;
          
          score += tierBonus * urgencyMultiplier;
          score *= 4; // LIAISON PROTOCOL: 4x Multiplier for Paid Visibility
      }
  }

  // 3. 🔗 SEMANTIC CONTINUITY: Find "Related Videos" (Autoplay logic)
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
