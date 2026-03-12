
'use client';

/**
 * @fileOverview Marketplace Ranking Logic.
 * Implements the professional multi-signal product scoring equation.
 * Upgraded with AI Search Ranking, Campus Intelligence, and Smart Vendor Ranking.
 */

import type { Product, MarketProfile, User } from './types';
import type { VibeProfile } from '@/hooks/use-vibe-profile';

/**
 * computeVendorScore
 * -------------------
 * Calculates a reliability score for the merchant based on historical performance.
 * Formula: (Rating * 0.4) + (DeliveryRate * 25) + (log(Sales+1) * 3) + (1/ResponseTime * 10)
 */
export function computeVendorScore(product: Product) {
  // 1. Quality Signal (40% Weight)
  const rating = (product.vendorRating || product.rating || 5) * 0.4;
  
  // 2. Reliability Signal (25% Weight)
  // Assuming deliveryRate is 0-1 (e.g. 0.98 for 98% success)
  const delivery = (product.vendorDeliveryRate || 0.95) * 25;
  
  // 3. Sales Volume (20% Weight - Logarithmic)
  // Rewards established businesses without extreme outlier bias
  const sales = Math.log((product.vendorSalesCount || product.salesCount || 0) + 1) * 3;
  
  // 4. Response Speed (15% Weight - Inverse)
  // capped min response time at 0.5 hours to avoid spikes
  const responseTime = Math.max(product.vendorResponseTime || 2, 0.5);
  const response = (1 / responseTime) * 10;

  return rating + delivery + sales + response;
}

/**
 * computeMarketScore
 * ------------------
 * The professional marketplace recommendation formula.
 * Combines category interest, tag matching, vendor affinity, and campus intelligence.
 * Now featuring the Smart Vendor Boost (VendorScore * 2).
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

  // 🎯 2. SMART VENDOR RELIABILITY BOOST (Weight: 2x Vendor Score)
  // Ensures high-performing, trusted vendors lead the Yard feed.
  const vendorScore = computeVendorScore(product);
  score += vendorScore * 2;

  if (!marketProfile && !user) return score;

  // 3. CATEGORY INTEREST (User Weight: 3x Views, 6x Intent, 12x Purchase)
  if (marketProfile) {
    const views = marketProfile.viewedCategories?.[product.category] || 0;
    const intents = marketProfile.intentCategories?.[product.category] || 0;
    const purchases = marketProfile.purchasedCategories?.[product.category] || 0;

    score += views * 3;
    score += intents * 6; 
    score += purchases * 12;
  }

  // 4. CAMPUS-SPECIFIC INTELLIGENCE (Weight: Location & Faculty)
  if (user) {
    // Same Campus Boost (+10)
    if (product.campusId === user.campusId) {
        score += 10;
    }

    // Academic Alignment Boost (+5): Matching major/department
    const userMajor = (user.major || '').toLowerCase();
    const productTags = (product.tags || []).map(t => t.toLowerCase());
    if (userMajor && productTags.includes(userMajor)) {
        score += 5;
    }
    
    // Proximity Ranking: Location Match
    if (product.campusAcronym === user.campusAcronym) {
        score += 4;
    }
  }

  // 5. THE VIBE BRIDGE (Tag Match - User Weight: 2x)
  if (vibeProfile && product.tags) {
    product.tags.forEach(tag => {
      const weight = vibeProfile.tagWeights[tag.toLowerCase()] || 0;
      score += weight * 2;
    });
  }

  // 6. VENDOR AFFINITY
  if (marketProfile) {
    const vendorHits = marketProfile.favoriteVendors?.[product.vendorId] || 0;
    if (vendorHits > 0) {
      score += 5;
      score += Math.min(vendorHits * 2, 15);
    }
  }

  // 7. TRENDING BOOST (Weight: 2x Velocity)
  if (product.trendScore) {
    score += product.trendScore * 2;
  }

  // 8. PRICE RANGE MATCH (Max 15 pts)
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
