
'use client';

/**
 * @fileOverview Marketplace Ranking Logic.
 * Implements the multi-signal product scoring equation.
 */

import type { Product, MarketProfile } from './types';
import type { VibeProfile } from '@/hooks/use-vibe-profile';

/**
 * computeMarketScore
 * ------------------
 * The professional marketplace recommendation formula.
 */
export function computeMarketScore(
  product: Product,
  marketProfile: MarketProfile | null,
  vibeProfile: VibeProfile | null
) {
  let score = 0;

  if (!marketProfile) return 0;

  // 1. CATEGORY MATCH (Max 50 pts)
  const views = marketProfile.viewedCategories?.[product.category] || 0;
  const intents = marketProfile.intentCategories?.[product.category] || 0;
  const purchases = marketProfile.purchasedCategories?.[product.category] || 0;

  score += Math.min(views * 2, 20);
  score += Math.min(intents * 5, 25);
  score += Math.min(purchases * 10, 50);

  // 2. TAG MATCH (The Conceptual Bridge - Max 40 pts)
  // This matches product tags against the user's video discovery interests
  if (vibeProfile && product.tags) {
    let tagSum = 0;
    product.tags.forEach(tag => {
      const weight = vibeProfile.tagWeights[tag.toLowerCase()] || 0;
      tagSum += weight;
    });
    score += Math.min(tagSum * 0.8, 40);
  }

  // 3. VENDOR AFFINITY (Max 30 pts)
  const vendorHits = marketProfile.favoriteVendors?.[product.vendorId] || 0;
  score += Math.min(vendorHits * 4, 30);

  // 4. PRICE MATCH (Max 25 pts)
  if (marketProfile.pricePreference) {
    const { min, max } = marketProfile.pricePreference;
    if (product.price >= min && product.price <= max) {
      score += 25;
    } else {
      // Penalty for distance from preferred range
      const distance = product.price < min ? min - product.price : product.price - max;
      score += Math.max(0, 25 - (distance / 50));
    }
  }

  // 5. POPULARITY (Max 35 pts)
  const salesBoost = (product.salesCount || 0) * 8;
  const viewBoost = (product.viewCount || 0) * 0.2;
  const trustBoost = ((product.rating || 5) - 3) * 10;
  score += Math.min(salesBoost + viewBoost + trustBoost, 35);

  // 6. FRESHNESS DECAY
  if (product.createdAt) {
    const createdAt = typeof product.createdAt === 'string' ? new Date(product.createdAt) : (product.createdAt.toDate ? product.createdAt.toDate() : new Date(product.createdAt));
    const ageHours = (Date.now() - createdAt.getTime()) / 3600000;
    score += 15 * Math.exp(-ageHours / 48); // 48-hour half-life for products
  }

  return score;
}
