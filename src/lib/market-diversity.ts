'use client';

import type { Product } from "./types";

/**
 * 🎨 MARKETPLACE DIVERSITY ENGINE
 * 
 * Enforces balance across vendors and categories.
 * Rules:
 * - Max 2 products per vendor per window.
 * - Max 3 products per category per window.
 */
export function enforceMarketDiversity(products: Product[], limit = 40): Product[] {
  if (!products || products.length === 0) return [];

  const result: Product[] = [];
  const pool = [...products];
  
  const vendorCount = new Map<string, number>();
  const categoryCount = new Map<string, number>();

  // Professional Thresholds
  const MAX_PER_VENDOR = 2;
  const MAX_PER_CATEGORY = 3;

  while (pool.length > 0 && result.length < limit) {
    let bestIdx = -1;
    
    // Find the highest ranked product that satisfies diversity rules
    for (let i = 0; i < Math.min(pool.length, 50); i++) {
      const p = pool[i];
      const vCount = vendorCount.get(p.vendorId) || 0;
      const cCount = categoryCount.get(p.category) || 0;

      if (vCount < MAX_PER_VENDOR && cCount < MAX_PER_CATEGORY) {
        bestIdx = i;
        break;
      }
    }

    // Fallback: If no product satisfies constraints, take the top one to keep feed alive
    if (bestIdx === -1) {
      bestIdx = 0;
    }

    const selected = pool.splice(bestIdx, 1)[0];
    result.push(selected);

    // Update trackers
    vendorCount.set(selected.vendorId, (vendorCount.get(selected.vendorId) || 0) + 1);
    categoryCount.set(selected.category, (categoryCount.get(selected.category) || 0) + 1);
  }

  return result;
}
