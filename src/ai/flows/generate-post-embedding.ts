'use server';
/**
 * @fileOverview A utility to generate semantic vector embeddings for campus vibrations.
 *
 * - generatePostEmbedding - Generates a semantic vector for a post's content and tags.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EmbeddingInputSchema = z.object({
  content: z.string().describe('The main text content of the post.'),
  tags: z.array(z.string()).optional().describe('Hashtags associated with the post.'),
});

export async function generatePostEmbedding(input: z.infer<typeof EmbeddingInputSchema>): Promise<number[] | null> {
  const text = `${input.content} ${(input.tags || []).join(' ')}`.trim();
  
  if (!text) return null;

  try {
    const embedding = await ai.embed({
      model: 'googleai/text-embedding-004',
      content: text,
    });

    return embedding;
  } catch (error) {
    console.error("Liaison AI Error: Embedding generation failed:", error);
    return null;
  }
}
