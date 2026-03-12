
'use client';

/**
 * @fileOverview Final Marketplace Ranking Engine.
 * Implements the professional multi-signal product scoring equation.
 * 
 * Pipeline:
 * 1. Intent (AI Parsed & Category matching)
 * 2. Semantic Tag Matching (Conceptual similarity)
 * 3. Reputed Trust (Vendor scoring)
 * 4. Financial Value (Deal detection)
 * 5. Momentum (Trending velocity)
 * 6. Cultural Fit (Vibe tag matching)
 * 7. Proximity (Campus intelligence)
 * 8. Recency (Freshness decay)
 */

import type { Product, MarketProfile, User, MarketIntent } from './types';
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
 * computeTagSimilarity (Step 3)
 * -----------------------------
 * Matches intent tags with product tags for a conceptual boost.
 */
export function computeTagSimilarity(intentTags: string[] | undefined, productTags: string[] | undefined) {
    if (!intentTags || !productTags) return 0;
    let score = 0;
    for (const tag of intentTags) {
        if (productTags.map(t => t.toLowerCase()).includes(tag.toLowerCase())) {
            score += 5; // Step 3: Specific boost per tag match
        }
    }
    return score;
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
  searchQuery: string = '',
  parsedIntent?: MarketIntent | null
) {
  let score = 0;

  // 🧠 1. AI INTENT BOOST (The Smart Assistant Layer)
  if (parsedIntent) {
      // Category Match (Major Signal)
      if (parsedIntent.category && product.category.toLowerCase() === parsedIntent.category.toLowerCase()) {
          score += 30;
      }
      
      // Step 3: Semantic Tag Match (Deep Relevance)
      const tagSimilarity = computeTagSimilarity(parsedIntent.tags, product.tags);
      score += tagSimilarity;
      
      // Price Relevance (Hard Constraint Match)
      if (parsedIntent.priceMax && product.price <= parsedIntent.priceMax) {
          score += 15;
      }
      if (parsedIntent.priceMin && product.price >= parsedIntent.priceMin) {
          score += 5;
      }
      
      // Intent/Context Match (Study, Gym, etc)
      if (parsedIntent.intent && product.tags?.map(t => t.toLowerCase()).includes(parsedIntent.intent.toLowerCase())) {
          score += 20;
      }
  } else if (searchQuery.trim()) {
    // Basic Keyword Fallback
    const term = searchQuery.toLowerCase().trim();
    if (product.name.toLowerCase().includes(term)) score += 20;
    if (product.category.toLowerCase().includes(term)) score += 15;
    if (product.tags?.some(t => t.toLowerCase().includes(term))) score += 12;
  }

  // 🛡️ 2. VENDOR TRUST SCORE (The Reputational Pillar)
  const vendorScore = computeVendorScore(product);
  score += vendorScore * 2;

  // 💰 3. DEAL DETECTION (The Financial Pillar)
  const dealBoost = computeDealBoost(product.averagePrice, product.price);
  score += dealBoost;

  // 🏎️ 4. TRENDING MOMENTUM (The Momentum Pillar)
  // trendScore = (viewCount * 1) + (cartCount * 4) + (purchaseCount * 8) + (shareCount * 3)
  if (product.trendScore) {
    score += product.trendScore * 2;
  }

  // 📊 5. COMMERCIAL INTENT (Category Interest from Profile)
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

  // 🌉 6. THE VIBE BRIDGE (Video Vibe Profile Cross-Reference)
  if (vibeProfile && product.tags) {
    product.tags.forEach(tag => {
      const weight = vibeProfile.tagWeights[tag.toLowerCase()] || 0;
      score += weight * 2;
    });
  }

  // 📍 7. CAMPUS INTELLIGENCE
  if (user) {
    // Proximity Boost (Same Campus)
    if (product.campusId === user.campusId) score += 4;
    
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
    
    // Apply 24-hour decay factor
    const decayFactor = Math.exp(-ageHours / 24);
    score *= decayFactor;
  }

  return score;
}
