/**
 * @fileOverview Trending Score Utility.
 * Implements the weighted trend score formula for marketplace products.
 * view = 1, cart = 4, purchase = 8, share = 3
 */

export function computeTrendScore(trend: { 
  viewCount: number; 
  cartCount: number; 
  purchaseCount: number; 
  shareCount: number; 
}) {
  return (
    (trend.viewCount || 0) * 1 +
    (trend.cartCount || 0) * 4 +
    (trend.purchaseCount || 0) * 8 +
    (trend.shareCount || 0) * 3
  );
}
