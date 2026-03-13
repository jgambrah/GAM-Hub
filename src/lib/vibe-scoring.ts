import type { SocialPost, UserIntelligence, VibeMood } from './types';
import { cosineSimilarity } from './utils';

/**
 * computeVibeScore
 * ----------------
 * Professional ranking algorithm combining Personalization, Trends, and Neural Similarity.
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

  // 1. 🧠 NEURAL SEARCH: Match search query vector to post embedding (Primary discovery)
  if (queryVector && candidate.embedding) {
    const similarity = cosineSimilarity(queryVector, candidate.embedding);
    if (similarity > 0.7) {
      score += similarity * 100; // Strongest signal for active search
    }
  }

  // 2. 🔗 SEMANTIC SIMILARITY: Find "Related Videos" (Autoplay logic)
  if (currentPost?.embedding && candidate.embedding) {
    const similarity = cosineSimilarity(currentPost.embedding, candidate.embedding);
    if (similarity > 0.8) {
      score += similarity * 40; 
    }
  }

  // 3. 🎯 PERSONALIZATION: Match to long-term User Taste Vector
  if (userIntelligence?.tasteVector && candidate.embedding) {
    const similarity = cosineSimilarity(userIntelligence.tasteVector, candidate.embedding);
    if (similarity > 0.8) {
      score += similarity * 30;
    }
  }

  // 4. 📈 TREND BOOST: Global momentum (5x Weight)
  const globalTrendValue = globalTrendScores[candidate.id] || 0;
  score += globalTrendValue * 5;

  // 5. 🏗️ ENGAGEMENT: Native metrics
  const engagementScore = (candidate.likes || 0) * 2 + (candidate.commentCount || 0) * 3;
  score += Math.min(engagementScore, 50);

  // 6. 🌍 FRESHNESS DECAY
  if (candidate.createdAt) {
    const date = new Date(candidate.createdAt);
    const ageHours = (Date.now() - date.getTime()) / 3600000;
    score *= Math.exp(-ageHours / 24);
  }

  return score;
}
