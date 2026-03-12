
'use client';

/**
 * @fileOverview Marketplace Ranking Engine.
 * Upgraded to use the Unified Intelligence Brain + Knowledge Graph expansion.
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
 * Commercial Discovery with Knowledge Graph Support.
 */
export function computeMarketScore(
  product: Product,
  unifiedIntelligence: Partial<UserIntelligence> | null,
  user: User | null,
  searchQuery: string = '',
  parsedIntent?: MarketIntent | null,
  expandedInterests: Record<string, number> = {} // New: Expanded Graph interests
) {
  let score = 0;

  // 1. AI Intent & Keyword Matching
  if (parsedIntent) {
      if (parsedIntent.category && product.category.toLowerCase() === parsedIntent.category.toLowerCase()) score += 35;
      if (parsedIntent.intent && product.tags?.includes(parsedIntent.intent)) score += 20;
  } else if (searchQuery.trim()) {
    const term = searchQuery.toLowerCase().trim();
    if (product.name.toLowerCase().includes(term)) score += 25;
    if (product.category.toLowerCase().includes(term)) score += 15;
  }

  // 2. 🧠 UNIFIED BRAIN + 🕸️ GRAPH SIGNALS
  if (unifiedIntelligence?.interests) {
    const productCategory = product.category.toLowerCase();
    
    // 🎯 Direct Match (3x Weight)
    const catWeight = unifiedIntelligence.interests[productCategory] || 0;
    score += catWeight * 3.0; 

    // Match product tags
    if (product.tags) {
        product.tags.forEach(tag => {
            const normalizedTag = tag.toLowerCase();
            // Direct Boost
            const weight = unifiedIntelligence.interests![normalizedTag] || 0;
            score += weight * 2.0;

            // 🕸️ Graph Expansion Boost (0.8x Weight)
            const graphWeight = expandedInterests[normalizedTag] || 0;
            score += graphWeight * 0.8;
        });
    }

    // Vendor Affinity (Strength of past interactions)
    if (unifiedIntelligence.affinities?.vendors?.[product.vendorId]) {
        score += (unifiedIntelligence.affinities.vendors[product.vendorId]) * 5;
    }
  }

  // 3. Proximity & Momentum
  if (user && product.campusId === user.campusId) score += 5;
  if (product.trendScore) score += product.trendScore * 0.5;

  // 4. Freshness Decay
  if (product.createdAt) {
    const date = typeof product.createdAt === 'string' ? new Date(product.createdAt) : product.createdAt.toDate();
    const ageHours = (Date.now() - date.getTime()) / 3600000;
    // Faster decay for older marketplace listings to keep it fresh
    score *= Math.exp(-ageHours / 48);
  }

  return score;
}
