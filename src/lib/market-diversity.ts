'use client';

import type { Product } from "./types";

/**
 * 🎨 MARKETPLACE DIVERSITY ENGINE - PROFESSIONAL EDITION
 * 
 * Final stage filtering to prevent marketplace feeds from becoming repetitive.
 * Enforces a "Variety Protocol" across vendors and categories.
 * 
 * Rules:
 * - Max 2 products per vendor in the initial window.
 * - Max 3 products per category in the initial window.
 * - Prevents streaks of the same category (e.g. 10 phones in a row).
 */
export function enforceMarketDiversity(products: Product[], limit = 40): Product[] {
  if (!products || products.length === 0) return [];

  const result: Product[] = [];
  const pool = [...products];
  
  const vendorCount = new Map<string, number>();
  const categoryCount = new Map<string, number>();

  // professional Diversity Thresholds
  const MAX_PER_VENDOR = 2;
  const MAX_PER_CATEGORY = 3;

  while (pool.length > 0 && result.length < limit) {
    let bestIdx = -1;
    
    // Find the highest ranked product that satisfies the "Variety Protocol"
    for (let i = 0; i < Math.min(pool.length, 50); i++) {
      const p = pool[i];
      const vCount = vendorCount.get(p.vendorId) || 0;
      const cCount = categoryCount.get(p.category) || 0;

      if (vCount < MAX_PER_VENDOR && cCount < MAX_PER_CATEGORY) {
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
