
'use server';
/**
 * @fileOverview Liaison AI Product Embedding Generator.
 * Converts marketplace inventory into semantic vectors for neural discovery.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProductEmbeddingInputSchema = z.object({
  name: z.string().describe('The name of the product.'),
  description: z.string().describe('The description of the product.'),
  category: z.string().describe('The category of the product.'),
});

export async function generateProductEmbedding(input: z.infer<typeof ProductEmbeddingInputSchema>): Promise<number[] | null> {
  const text = `${input.name} ${input.category} ${input.description}`.trim();
  
  if (!text) return null;

  try {
    // 🧠 LIAISON BRAIN: Generate semantic vector using text-embedding-004
    const embedding = await ai.embed({
      model: 'googleai/text-embedding-004',
      content: text,
    });

    return embedding;
  } catch (error) {
    console.error("Liaison AI Error: Product embedding generation failed:", error);
    return null;
  }
}
