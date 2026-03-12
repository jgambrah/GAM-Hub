
'use client';

/**
 * @fileOverview Marketplace Ranking Engine.
 * Upgraded to use the Unified User Intelligence profile with high cross-platform weighting.
 */

import type { Product, UserIntelligence, User, MarketIntent } from './types';

export function computeVendorScore(product: Product) {
  const rating = (product.rating || 5) * 0.4;
  const sales = Math.log((product.salesCount || 0) + 1) * 3;
  return rating + sales;
}

/**
 * computeMarketScore
 * ------------------
 * The commercial discovery formula.
 * Now factors in the 3x multiplier for Unified Intelligence categories.
 */
export function computeMarketScore(
  product: Product,
  unifiedIntelligence: Partial<UserIntelligence> | null,
  user: User | null,
  searchQuery: string = '',
  parsedIntent?: MarketIntent | null
) {
  let score = 0;

  // 1. AI Intent & Keyword Matching
  if (parsedIntent) {
      if (parsedIntent.category && product.category.toLowerCase() === parsedIntent.category.toLowerCase()) score += 30;
      if (parsedIntent.intent && product.tags?.includes(parsedIntent.intent)) score += 20;
  } else if (searchQuery.trim()) {
    const term = searchQuery.toLowerCase().trim();
    if (product.name.toLowerCase().includes(term)) score += 20;
    if (product.category.toLowerCase().includes(term)) score += 15;
  }

  // 2. 🧠 UNIFIED BRAIN SIGNALS (Video Engagement + Market History)
  if (unifiedIntelligence?.interests) {
    // 🎯 THE CROSS-PLATFORM BOOST: score += userInterest[category] * 3
    // This connects video behavior directly to marketplace priority.
    const catWeight = unifiedIntelligence.interests[product.category.toLowerCase()] || 0;
    score += catWeight * 3.0; 

    // Match product tags (secondary signal)
    if (product.tags) {
        product.tags.forEach(tag => {
            const weight = unifiedIntelligence.interests![tag.toLowerCase()] || 0;
            score += weight * 2.0;
        });
    }

    // Vendor Affinity: High boost for merchants the user interacts with or follows
    if (unifiedIntelligence.affinities?.vendors?.[product.vendorId]) {
        score += (unifiedIntelligence.affinities.vendors[product.vendorId]) * 5;
    }
  }

  // 3. Proximity & Momentum
  if (user && product.campusId === user.campusId) score += 5;
  if (product.trendScore) score += product.trendScore * 0.5;

  // 4. Freshness: Exponential decay for older listings
  if (product.createdAt) {
    const date = typeof product.createdAt === 'string' ? new Date(product.createdAt) : product.createdAt.toDate();
    const ageHours = (Date.now() - date.getTime()) / 3600000;
    score *= Math.exp(-ageHours / 48);
  }

  return score;
}
