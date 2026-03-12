/**
 * @fileOverview Trend Decay Utility.
 * Implements exponential time decay for trending scores.
 * decayFactor = e^(-hours / 24)
 */

export function applyTrendDecay(trendScore: number, lastUpdated: string | number | Date) {
  const lastUpdatedDate = new Date(lastUpdated);
  const hours = (Date.now() - lastUpdatedDate.getTime()) / 3600000;
  
  // Apply 24-hour half-life decay
  // decayFactor = Math.exp(-hours / 24)
  const decayFactor = Math.exp(-hours / 24);
  
  return trendScore * decayFactor;
}
