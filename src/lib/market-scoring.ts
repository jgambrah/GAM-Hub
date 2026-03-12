
'use client';

/**
 * @fileOverview Marketplace Ranking Logic.
 * Implements the multi-signal product scoring equation.
 * Updated with user-requested multipliers and real-time velocity boost.
 */

import type { Product, MarketProfile } from './types';
import type { VibeProfile } from '@/hooks/use-vibe-profile';

/**
 * computeMarketScore
 * ------------------
 * The professional marketplace recommendation formula.
 * Combines category interest, tag matching (vibe bridge), vendor affinity, and velocity.
 */
export function computeMarketScore(
  product: Product,
  marketProfile: MarketProfile | null,
  vibeProfile: VibeProfile | null
) {
  let score = 0;

  if (!marketProfile) return 0;

  // 1. CATEGORY INTEREST (User Weight: 3x)
  const views = marketProfile.viewedCategories?.[product.category] || 0;
  const intents = marketProfile.intentCategories?.[product.category] || 0;
  const purchases = marketProfile.purchasedCategories?.[product.category] || 0;

  // Weighted category interest
  score += views * 3;
  score += intents * 6; // Intent is stronger than view
  score += purchases * 12; // Purchase is the strongest signal

  // 2. TAG MATCHING (The Vibe Bridge - User Weight: 2x)
  // This matches product tags against the user's video discovery interests
  if (vibeProfile && product.tags) {
    product.tags.forEach(tag => {
      const weight = vibeProfile.tagWeights[tag.toLowerCase()] || 0;
      score += weight * 2;
    });
  }

  // 3. VENDOR AFFINITY (User Weight: +5)
  const vendorHits = marketProfile.favoriteVendors?.[product.vendorId] || 0;
  if (vendorHits > 0) {
    score += 5;
    score += Math.min(vendorHits * 2, 15); // Scaling affinity
  }

  // 4. POPULARITY & TRUST (User Weights: Sales * 0.1, Rating * 2)
  score += (product.salesCount || 0) * 0.1;
  score += (product.rating || 5) * 2;
  
  const viewBoost = (product.viewCount || 0) * 0.05;
  score += Math.min(viewBoost, 10);

  // 5. TRENDING BOOST (User Weight: 2x velocity)
  // trendScore is calculated by Cloud Functions based on recent 15-min velocity
  score += (product.trendScore || 0) * 2;

  // 6. PRICE MATCH (Max 15 pts)
  if (marketProfile.pricePreference) {
    const { min, max } = marketProfile.pricePreference;
    if (product.price >= min && product.price <= max) {
      score += 15;
    } else {
      // Penalty for distance from preferred range
      const distance = product.price < min ? min - product.price : product.price - max;
      score += Math.max(0, 15 - (distance / 100));
    }
  }

  // 7. FRESHNESS DECAY
  if (product.createdAt) {
    const createdAt = typeof product.createdAt === 'string' ? new Date(product.createdAt) : (product.createdAt.toDate ? product.createdAt.toDate() : new Date(product.createdAt));
    const ageHours = (Date.now() - createdAt.getTime()) / 3600000;
    score += 10 * Math.exp(-ageHours / 48); // 48-hour half-life for products
  }

  return score;
}
