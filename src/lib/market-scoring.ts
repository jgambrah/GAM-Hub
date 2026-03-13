
'use client';

/**
 * @fileOverview Marketplace Ranking Engine.
 * Upgraded to use the Unified Intelligence Brain + Knowledge Graph expansion + Global Trend Boosting.
 * Includes Neural Vector Similarity and Content-to-Commerce matching.
 */

import type { Product, UserIntelligence, User, MarketIntent } from './types';
import { cosineSimilarity } from './utils';

export function computeVendorScore(product: Product) {
  const rating = (product.rating || 5) * 0.4;
  const sales = Math.log((product.salesCount || 0) + 1) * 3;
  return rating + sales;
}

/**
 * computeMarketScore
 * ------------------
 * Commercial Discovery with Knowledge Graph Support and Neural Alignment.
 */
export function computeMarketScore(
  product: Product,
  unifiedIntelligence: Partial<UserIntelligence> | null,
  globalTrendScores: Record<string, number> = {},
  user: User | null,
  searchQuery: string = '',
  parsedIntent?: MarketIntent | null,
  expandedInterests: Record<string, number> = {},
  queryVector: number[] | null = null,
  activeVideoEmbedding: number[] | null = null
) {
  let score = 0;

  // 1. 🚀 REAL-TIME TREND BOOST (4x Weight)
  const trendBoost = globalTrendScores[product.id] || 0;
  score += trendBoost * 4;

  const categoryTrend = globalTrendScores[product.category.toLowerCase()] || 0;
  score += categoryTrend * 2;

  // 2. 🛍️ CONTENT-TO-COMMERCE BRIDGE (Semantic Bridge)
  // Match product to the video currently being watched
  if (activeVideoEmbedding && product.embedding) {
      const bridgeSimilarity = cosineSimilarity(activeVideoEmbedding, product.embedding);
      if (bridgeSimilarity > 0.75) {
          score += bridgeSimilarity * 50; // Strongest bridge signal
      }
  }

  // 3. AI Intent & Keyword Matching
  if (parsedIntent) {
      if (parsedIntent.category && product.category.toLowerCase() === parsedIntent.category.toLowerCase()) score += 35;
      if (parsedIntent.intent && product.tags?.includes(parsedIntent.intent)) score += 20;
  } else if (searchQuery.trim()) {
    const term = searchQuery.toLowerCase().trim();
    if (product.name.toLowerCase().includes(term)) score += 25;
    if (product.category.toLowerCase().includes(term)) score += 15;
  }

  // 4. 🧠 NEURAL SEARCH: Match search query vector to product embedding
  if (queryVector && product.embedding) {
      const similarity = cosineSimilarity(queryVector, product.embedding);
      if (similarity > 0.7) {
          score += similarity * 60; // Powerful neural alignment boost
      }
  }

  // 5. 🧠 UNIFIED BRAIN + 🕸️ GRAPH SIGNALS
  if (unifiedIntelligence?.interests) {
    const productCategory = product.category.toLowerCase();
    
    // 🎯 Direct Match (3x Weight)
    const catWeight = unifiedIntelligence.interests[productCategory] || 0;
    score += catWeight * 3.0; 

    // 🧠 TASTE VECTOR MATCH: Match user's long-term style to product vibe
    if (unifiedIntelligence.tasteVector && product.embedding) {
        const styleSimilarity = cosineSimilarity(unifiedIntelligence.tasteVector, product.embedding);
        if (styleSimilarity > 0.8) {
            score += styleSimilarity * 40;
        }
    }

    // 🕸️ Graph Expansion Match (1.5x Weight)
    const expandedCatWeight = expandedInterests[productCategory] || 0;
    score += expandedCatWeight * 1.5;

    if (product.tags) {
        product.tags.forEach(tag => {
            const normalizedTag = tag.toLowerCase();
            const weight = unifiedIntelligence.interests![normalizedTag] || 0;
            score += weight * 2.0;

            const graphWeight = expandedInterests[normalizedTag] || 0;
            score += graphWeight * 0.8;
        });
    }

    if (unifiedIntelligence.affinities?.vendors?.[product.vendorId]) {
        score += (unifiedIntelligence.affinities.vendors[product.vendorId]) * 5;
    }
  }

  // 6. Proximity & Momentum
  if (user && product.campusId === user.campusId) score += 5;
  if (product.trendScore) score += product.trendScore * 0.5;

  // 7. Freshness Decay
  if (product.createdAt) {
    const date = typeof product.createdAt === 'string' ? new Date(product.createdAt) : product.createdAt.toDate();
    const ageHours = (Date.now() - date.getTime()) / 3600000;
    score *= Math.exp(-ageHours / 48);
  }

  return score;
}
