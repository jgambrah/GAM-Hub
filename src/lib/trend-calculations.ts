
/**
 * @fileOverview Liaison Trend Scoring Utility.
 * Implements the natural decay formula to ensure viral vibes fade over time.
 * Formula: score = events / (ageHours + 1)
 */

/**
 * Calculates a time-decayed trend score.
 * 
 * @param events The total number of raw interactions (views, likes, etc.) in the window.
 * @param ageHours The number of hours since the entity was posted.
 * @returns A normalized score that rewards both volume and freshness.
 */
export function calculateTrendScore(events: number, ageHours: number): number {
  // We add 1 to the denominator to prevent division by zero for brand-new posts
  // and to ensure the maximum score is equal to the raw event count.
  return events / (ageHours + 1);
}

/**
 * Helper to calculate age in hours from an ISO string or Timestamp.
 */
export function getAgeInHours(createdAt: string | number | Date): number {
  const postDate = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - postDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return Math.max(0, diffHours);
}
