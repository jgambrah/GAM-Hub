
'use client';

/**
 * @fileOverview Marketplace Ranking Logic.
 * Implements the professional multi-signal product scoring equation.
 * Upgraded with AI Search Ranking, Vendor Trust, and Price Intelligence.
 */

import type { Product, MarketProfile, User } from './types';
import type { VibeProfile } from '@/hooks/use-vibe-profile';

/**
 * computeVendorScore
 * -------------------
 * Calculates a reliability score for the merchant based on historical performance.
 */
export function computeVendorScore(product: Product) {
  // 1. Quality Signal (40% Weight)
  const rating = (product.vendorRating || product.rating || 5) * 0.4;
  
  // 2. Reliability Signal (25% Weight)
  const delivery = (product.vendorDeliveryRate || 0.95) * 25;
  
  // 3. Sales Volume (20% Weight - Logarithmic)
  const sales = Math.log((product.vendorSalesCount || product.salesCount || 0) + 1) * 3;
  
  // 4. Response Speed (15% Weight - Inverse)
  const responseTime = Math.max(product.vendorResponseTime || 2, 0.5);
  const response = (1 / responseTime) * 10;

  return rating + delivery + sales + response;
}

/**
 * computeDealBoost
 * ----------------
 * Detects when a product becomes a good deal based on price history.
 * formula: (averagePrice - currentPrice) * 0.3
 */
export function computeDealBoost(avgPrice: number, currentPrice: number) {
  const discount = avgPrice - currentPrice;
  if (discount <= 0) return 0;
  return discount * 0.3;
}

/**
 * computeMarketScore
 * ------------------
 * The professional marketplace recommendation formula.
 * Now featuring the AI Price Intelligence deal boost.
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

    const tags = product.tags || [];
    if (tags.some(t => t.toLowerCase().includes(term))) {
        score += 12;
    }
  }

  // 🎯 2. SMART VENDOR RELIABILITY BOOST (Weight: 1.5x rating + reliability)
  const vendorScore = computeVendorScore(product);
  score += vendorScore * 1.5;

  // 💰 3. AI PRICE INTELLIGENCE (Deal Boost)
  if (product.averagePrice && product.price < product.averagePrice) {
    const dealBoost = computeDealBoost(product.averagePrice, product.price);
    score += dealBoost;
  }

  if (!marketProfile && !user) return score;

  // 4. CATEGORY INTEREST (User Weight: 3x Views, 6x Intent, 12x Purchase)
  if (marketProfile) {
    const views = marketProfile.viewedCategories?.[product.category] || 0;
    const intents = marketProfile.intentCategories?.[product.category] || 0;
    const purchases = marketProfile.purchasedCategories?.[product.category] || 0;

    score += views * 3;
    score += intents * 6; 
    score += purchases * 12;
  }

  // 5. CAMPUS-SPECIFIC INTELLIGENCE
  if (user) {
    if (product.campusId === user.campusId) score += 10;
    const userMajor = (user.major || '').toLowerCase();
    const productTags = (product.tags || []).map(t => t.toLowerCase());
    if (userMajor && productTags.includes(userMajor)) score += 5;
    if (product.campusAcronym === user.campusAcronym) score += 4;
  }

  // 6. THE VIBE BRIDGE (Tag Match - User Weight: 2x)
  if (vibeProfile && product.tags) {
    product.tags.forEach(tag => {
      const weight = vibeProfile.tagWeights[tag.toLowerCase()] || 0;
      score += weight * 2;
    });
  }

  // 7. TRENDING BOOST (Weight: 2x velocity)
  if (product.trendScore) {
    score += product.trendScore * 2;
  }

  // 8. PRICE RANGE MATCH
  if (marketProfile?.pricePreference) {
    const { min, max } = marketProfile.pricePreference;
    if (product.price >= min && product.price <= max) {
      score += 15;
    } else {
      const distance = product.price < min ? min - product.price : product.price - max;
      score += Math.max(0, 15 - (distance / 100));
    }
  }

  // 9. FRESHNESS DECAY
  if (product.createdAt) {
    const createdAt = typeof product.createdAt === 'string' ? new Date(product.createdAt) : (product.createdAt.toDate ? product.createdAt.toDate() : new Date(product.createdAt));
    const ageHours = (Date.now() - createdAt.getTime()) / 3600000;
    score += 10 * Math.exp(-ageHours / 48);
  }

  return score;
}
