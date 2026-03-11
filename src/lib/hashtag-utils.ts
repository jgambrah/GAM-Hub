'use client';

/**
 * @fileOverview Hashtag Extraction Engine for GAM Hub.
 * Parses hashtags from content strings while maintaining normalization standards.
 */

/**
 * Extracts hashtags from a given text string.
 * - Rules: Alphanumeric and underscores only.
 * - Limit: Max 10 tags per post to prevent spam.
 * - Normalization: All tags converted to lowercase.
 */
export function extractHashtags(text: string): string[] {
  if (!text) return [];

  const regex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.match(regex) || [];

  return matches
    .map(tag => tag.replace('#', '').toLowerCase())
    .filter((tag, index, self) => tag.length > 0 && self.indexOf(tag) === index) // Unique non-empty tags
    .slice(0, 10);
}
