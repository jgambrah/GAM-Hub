'use client';

/**
 * @fileOverview Final Marketplace Ranking Engine.
 * Implements the professional multi-signal product scoring equation.
 * 
 * Pipeline:
 * 1. Intent (Category matching)
 * 2. Reputed Trust (Vendor scoring)
 * 3. Financial Value (Deal detection)
 * 4. Momentum (Trending velocity)
 * 5. Cultural Fit (Vibe tag matching)
 * 6. Proximity (Campus intelligence)
 * 7. Recency (Freshness decay)
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
 */
export function computeDealBoost(avgPrice: number | undefined, currentPrice: number) {
  if (!avgPrice) return 0;
  const discount = avgPrice - currentPrice;
  if (discount <= 0) return 0;
  // Apply a 0.3x multiplier to the absolute GHS savings
  return discount * 0.3;
}

/**
 * computeMarketScore
 * ------------------
 * The definitive Marketplace Ranking Formula.
 */
export function computeMarketScore(
  product: Product,
  marketProfile: MarketProfile | null,
  vibeProfile: VibeProfile | null,
  user: User | null,
  searchQuery: string = ''
) {
  let score = 0;

  // 1. AI SEARCH RELEVANCE (Initial Boost)
  if (searchQuery.trim()) {
    const term = searchQuery.toLowerCase().trim();
    if (product.name.toLowerCase().includes(term)) score += 20;
    if (product.category.toLowerCase().includes(term)) score += 15;
    if (product.tags?.some(t => t.toLowerCase().includes(term))) score += 12;
  }

  // 🛡️ 2. VENDOR TRUST SCORE (The Reputational Pillar)
  // Reliability score from the merchant is added directly
  const vendorScore = computeVendorScore(product);
  score += vendorScore;

  // 💰 3. DEAL DETECTION (The Financial Pillar)
  const dealBoost = computeDealBoost(product.averagePrice, product.price);
  score += dealBoost;

  // 🏎️ 4. TRENDING VELOCITY (The Momentum Pillar)
  if (product.trendScore) {
    score += product.trendScore * 2;
  }

  // 📊 5. COMMERCIAL INTENT (Category Interest)
  if (marketProfile) {
    const views = marketProfile.viewedCategories?.[product.category] || 0;
    const intents = marketProfile.intentCategories?.[product.category] || 0;
    const purchases = marketProfile.purchasedCategories?.[product.category] || 0;

    // Weights: Views (3x), Intent (6x), Purchase (12x)
    score += views * 3;
    score += intents * 6; 
    score += purchases * 12;

    // Price Range Match
    if (marketProfile.pricePreference) {
      const { min, max } = marketProfile.pricePreference;
      if (product.price >= min && product.price <= max) {
        score += 10;
      } else {
        const distance = product.price < min ? min - product.price : product.price - max;
        score += Math.max(0, 10 - (distance / 50));
      }
    }
  }

  // 🌉 6. THE VIBE BRIDGE (Tag Match)
  // Cross-references with the user's Video Discovery Profile
  if (vibeProfile && product.tags) {
    product.tags.forEach(tag => {
      const weight = vibeProfile.tagWeights[tag.toLowerCase()] || 0;
      score += weight * 2;
    });
  }

  // 📍 7. CAMPUS INTELLIGENCE
  if (user) {
    // Proximity Boost (Same Campus)
    if (product.campusId === user.campusId) score += 10;
    
    // Academic Boost (Same Major/Department)
    const userMajor = (user.major || '').toLowerCase();
    if (userMajor && product.tags?.some(t => t.toLowerCase() === userMajor)) {
        score += 5;
    }
  }

  // 8. POPULARITY (Base Signals)
  score += (product.salesCount || 0) * 0.1;
  score += (product.rating || 5) * 2;

  // 📉 9. FRESHNESS DECAY
  if (product.createdAt) {
    const createdAt = typeof product.createdAt === 'string' ? new Date(product.createdAt) : (product.createdAt.toDate ? product.createdAt.toDate() : new Date(product.createdAt));
    const ageHours = (Date.now() - createdAt.getTime()) / 3600000;
    // Slow decay over 48 hours
    score += 10 * Math.exp(-ageHours / 48);
  }

  return score;
}
