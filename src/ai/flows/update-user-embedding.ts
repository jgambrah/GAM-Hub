'use server';
/**
 * @fileOverview Generates a semantic vector for a user's taste based on their top interests.
 * 
 * - generateUserEmbedding - Function to convert interests into a taste vector.
 */
import { ai } from '@/ai/genkit';

export async function generateUserEmbedding(interests: string[]) {
  const text = interests.join(' ').trim();
  
  if (!text) return null;

  try {
    const embedding = await ai.embed({
      model: 'googleai/text-embedding-004',
      content: text,
    });

    return embedding;
  } catch (error) {
    console.error("Liaison AI Error: User taste embedding generation failed:", error);
    return null;
  }
}
