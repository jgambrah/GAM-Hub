
'use client';

import type { Product } from "./types";

/**
 * 🎨 MARKETPLACE DIVERSITY ENGINE - PROFESSIONAL EDITION
 * 
 * Final stage filtering to prevent marketplace feeds from becoming repetitive.
 * Enforces a "Variety Protocol" across vendors and categories.
 * 
 * Upgraded to factor in Trending Boost while maintaining variety.
 */
export function enforceMarketDiversity(products: Product[], limit = 40): Product[] {
  if (!products || products.length === 0) return [];

  const result: Product[] = [];
  const pool = [...products];
  
  const vendorCount = new Map<string, number>();
  const categoryCount = new Map<string, number>();

  // Professional Diversity Thresholds
  const MAX_PER_VENDOR = 2;
  const MAX_PER_CATEGORY = 3;

  while (pool.length > 0 && result.length < limit) {
    let bestIdx = -1;
    
    // Find the highest ranked product that satisfies the "Variety Protocol"
    for (let i = 0; i < Math.min(pool.length, 50); i++) {
      const p = pool[i];
      const vCount = vendorCount.get(p.vendorId) || 0;
      const cCount = categoryCount.get(p.category) || 0;

      // Rule: Trending products (trendScore > 20) can bypass one vendor limit 
      // but still respect category limits to prevent mono-category feeds.
      const isUltraTrending = (p.trendScore || 0) > 20;
      const effectiveMaxVendor = isUltraTrending ? MAX_PER_VENDOR + 1 : MAX_PER_VENDOR;

      if (vCount < effectiveMaxVendor && cCount < MAX_PER_CATEGORY) {
        bestIdx = i;
        break;
      }
    }

    // FALLBACK: If no product satisfies diversity, take the next top-ranked one
    // to ensure we still fill the feed for smaller inventory pools.
    if (bestIdx === -1) {
      bestIdx = 0;
    }

    const selected = pool.splice(bestIdx, 1)[0];
    result.push(selected);

    // Update session selection trackers
    vendorCount.set(selected.vendorId, (vendorCount.get(selected.vendorId) || 0) + 1);
    categoryCount.set(selected.category, (categoryCount.get(selected.category) || 0) + 1);
  }

  return result;
}
