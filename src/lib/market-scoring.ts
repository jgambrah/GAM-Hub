'use client';

/**
 * @fileOverview Marketplace Ranking Logic.
 * Implements the professional multi-signal product scoring equation.
 * Finalized with Category Weights (3x/6x/12x), Vibe Bridge (2x), and Vendor Affinity (+5).
 */

import type { Product, MarketProfile } from './types';
import type { VibeProfile } from '@/hooks/use-vibe-profile';

/**
 * computeMarketScore
 * ------------------
 * The professional marketplace recommendation formula.
 * Combines category interest, tag matching (vibe bridge), vendor affinity, and reputation.
 */
export function computeMarketScore(
  product: Product,
  marketProfile: MarketProfile | null,
  vibeProfile: VibeProfile | null
) {
  let score = 0;

  if (!marketProfile) return 0;

  // 1. CATEGORY INTEREST (User Weight: 3x Views, 6x Intent, 12x Purchase)
  const views = marketProfile.viewedCategories?.[product.category] || 0;
  const intents = marketProfile.intentCategories?.[product.category] || 0;
  const purchases = marketProfile.purchasedCategories?.[product.category] || 0;

  score += views * 3;
  score += intents * 6; 
  score += purchases * 12;

  // 2. TAG MATCHING (The Vibe Bridge - User Weight: 2x)
  // Conceptually bridges Video Discovery interests to Marketplace products.
  if (vibeProfile && product.tags) {
    product.tags.forEach(tag => {
      // Historical tag weight from Vibe Feed engagement
      const weight = vibeProfile.tagWeights[tag.toLowerCase()] || 0;
      score += weight * 2;
    });
  }

  // 3. VENDOR AFFINITY (User Weight: +5 for favorites)
  const vendorHits = marketProfile.favoriteVendors?.[product.vendorId] || 0;
  if (vendorHits > 0) {
    score += 5;
    score += Math.min(vendorHits * 2, 15);
  }

  // 🛡️ 4. VENDOR REPUTATION & QUALITY (Weight: 1.5x)
  // Prioritizes established merchants with high quality ratings.
  score += (product.rating || 5) * 1.5;
  score += (product.salesCount || 0) * 0.1;

  // 🏎️ 5. TRENDING BOOST (Weight: 2x Velocity)
  // Amplifies products gaining rapid momentum on campus.
  if (product.trendScore) {
    score += product.trendScore * 2;
  }

  // 💰 6. PRICE RANGE MATCH (Max 15 pts)
  if (marketProfile.pricePreference) {
    const { min, max } = marketProfile.pricePreference;
    if (product.price >= min && product.price <= max) {
      score += 15;
    } else {
      // Penalize distance from preferred price range
      const distance = product.price < min ? min - product.price : product.price - max;
      score += Math.max(0, 15 - (distance / 100));
    }
  }

  // 📉 7. FRESHNESS DECAY
  if (product.createdAt) {
    const createdAt = typeof product.createdAt === 'string' ? new Date(product.createdAt) : (product.createdAt.toDate ? product.createdAt.toDate() : new Date(product.createdAt));
    const ageHours = (Date.now() - createdAt.getTime()) / 3600000;
    score += 10 * Math.exp(-ageHours / 48); // 48-hour half-life for initial boost
  }

  return score;
}
