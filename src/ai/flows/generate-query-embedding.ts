'use server';
/**
 * @fileOverview Liaison Semantic Query Engine.
 * Converts user search strings into high-dimensional vectors for semantic discovery.
 *
 * - generateQueryEmbedding - Function to convert a query into a vector.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QueryInputSchema = z.string().describe('The user search query to embed.');

export async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  if (!query || query.trim().length < 2) return null;

  try {
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
