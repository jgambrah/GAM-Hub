'use server';
/**
 * @fileOverview Liaison Semantic Query Engine.
 * Converts user search strings into high-dimensional vectors for semantic discovery.
 *
 * - generateQueryEmbedding - Function to convert a query into a vector.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  if (!query || query.trim().length < 2) return null;

  try {
    // 🧠 LIAISON BRAIN: Generate high-dimensional vector using text-embedding-004
    // This allows the system to understand 'meaning' rather than just keywords.
    const embedding = await ai.embed({
      model: 'googleai/text-embedding-004',
      content: query.trim(),
    });

    return embedding;
  } catch (error) {
    console.error("Liaison AI Error: Query embedding generation failed:", error);
    return null;
  }
}
