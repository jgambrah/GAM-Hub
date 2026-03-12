'use client';

/**
 * @fileOverview Marketplace Ranking Logic.
 * Implements the professional multi-signal product scoring equation.
 * Upgraded with AI Search Ranking and Campus-Specific Intelligence (Major/Location).
 */

import type { Product, MarketProfile, User } from './types';
import type { VibeProfile } from '@/hooks/use-vibe-profile';

/**
 * computeMarketScore
 * ------------------
 * The professional marketplace recommendation formula.
 * Combines category interest, tag matching, vendor affinity, and campus intelligence.
 */
export function computeMarketScore(
  product: Product,
  marketProfile: MarketProfile | null,
  vibeProfile: VibeProfile | null,
  user: User | null,
  searchQuery: string = ''
) {
  let score = 0;

  // 1. AI SEARCH RELEVANCE (Weight: 25 pts)
  if (searchQuery.trim()) {
    const term = searchQuery.toLowerCase().trim();
    const nameMatch = product.name.toLowerCase().includes(term);
    const descMatch = product.description.toLowerCase().includes(term);
    const categoryMatch = product.category.toLowerCase().includes(term);
    
    if (nameMatch) score += 15;
    if (categoryMatch) score += 10;
    if (descMatch) score += 5;

    // Semantic tag matching for search
    const tags = product.tags || [];
    if (tags.some(t => t.toLowerCase().includes(term))) {
        score += 12;
    }
  }

  if (!marketProfile && !user) return score;

  // 2. CATEGORY INTEREST (User Weight: 3x Views, 6x Intent, 12x Purchase)
  if (marketProfile) {
    const views = marketProfile.viewedCategories?.[product.category] || 0;
    const intents = marketProfile.intentCategories?.[product.category] || 0;
    const purchases = marketProfile.purchasedCategories?.[product.category] || 0;

    score += views * 3;
    score += intents * 6; 
    score += purchases * 12;
  }

  // 3. CAMPUS-SPECIFIC INTELLIGENCE (Weight: Location & Faculty)
  if (user) {
    // Same Campus Boost (+10) - redunant if filtered, but good for scoring
    if (product.campusId === user.campusId) {
        score += 10;
    }

    // Academic Alignment Boost (+5): Matching major/department
    const userMajor = (user.major || '').toLowerCase();
    const productTags = (product.tags || []).map(t => t.toLowerCase());
    if (userMajor && productTags.includes(userMajor)) {
        score += 5;
    }
    
    // Proximity Ranking: Location Match (Hall/Office area if tagged)
    if (product.campusAcronym === user.campusAcronym) {
        score += 4;
    }
  }

  // 4. THE VIBE BRIDGE (Tag Match - User Weight: 2x)
  if (vibeProfile && product.tags) {
    product.tags.forEach(tag => {
      const weight = vibeProfile.tagWeights[tag.toLowerCase()] || 0;
      score += weight * 2;
    });
  }

  // 5. VENDOR AFFINITY & REPUTATION
  if (marketProfile) {
    const vendorHits = marketProfile.favoriteVendors?.[product.vendorId] || 0;
    if (vendorHits > 0) {
      score += 5;
      score += Math.min(vendorHits * 2, 15);
    }
  }

  // Quality Signals (Weight: 1.5x)
  score += (product.rating || 5) * 1.5;
  score += (product.salesCount || 0) * 0.1;

  // 🏎️ 6. TRENDING BOOST (Weight: 2x Velocity)
  if (product.trendScore) {
    score += product.trendScore * 2;
  }

  // 💰 7. PRICE RANGE MATCH (Max 15 pts)
  if (marketProfile?.pricePreference) {
    const { min, max } = marketProfile.pricePreference;
    if (product.price >= min && product.price <= max) {
      score += 15;
    } else {
      const distance = product.price < min ? min - product.price : product.price - max;
      score += Math.max(0, 15 - (distance / 100));
    }
  }

  // 📉 8. FRESHNESS DECAY
  if (product.createdAt) {
    const createdAt = typeof product.createdAt === 'string' ? new Date(product.createdAt) : (product.createdAt.toDate ? product.createdAt.toDate() : new Date(product.createdAt));
    const ageHours = (Date.now() - createdAt.getTime()) / 3600000;
    score += 10 * Math.exp(-ageHours / 48);
  }

  return score;
}
