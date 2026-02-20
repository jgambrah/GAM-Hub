'use server';

/**
 * @fileOverview A Genkit flow for optimizing ad creative language for university students.
 *
 * - optimizeAdCreative - Rewrites formal ad headlines and slogans into student slang/vibe.
 * - OptimizeAdCreativeInput - Input schema for the flow.
 * - OptimizeAdCreativeOutput - Output schema for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OptimizeAdCreativeInputSchema = z.object({
  productName: z.string(),
  targetMajor: z.string(),
  rawHeadline: z.string(),
  rawSlogan: z.string(),
});
export type OptimizeAdCreativeInput = z.infer<typeof OptimizeAdCreativeInputSchema>;

const OptimizeAdCreativeOutputSchema = z.object({
  vibeHeadline: z.string(),
  vibeSlogan: z.string(),
});
export type OptimizeAdCreativeOutput = z.infer<typeof OptimizeAdCreativeOutputSchema>;

export async function optimizeAdCreative(input: OptimizeAdCreativeInput): Promise<OptimizeAdCreativeOutput> {
  return optimizeAdCreativeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'optimizeAdCreativePrompt',
  input: {schema: OptimizeAdCreativeInputSchema},
  output: {schema: OptimizeAdCreativeOutputSchema},
  prompt: `You are a student slang expert in Ghana, fluent in the "Yard Vibes" of universities like KNUST, UG Legon, UCC, and Ashesi.

Your task is to take a formal or boring ad copy from a vendor and rewrite it to sound authentic, catchy, and trendy for university students.

Guidelines:
- Keep it respectful but witty and funny.
- Use relevant student context (e.g., GPA, level 400 stress, hostel life, night market).
- Target the specific major if provided (e.g., if it's Law, mention the "Learned Friends").
- Use emojis sparingly but effectively.
- Make the headline "The Hook" and the slogan "The Vibe".

Product: {{{productName}}}
Target Major: {{{targetMajor}}}
Raw Headline: {{{rawHeadline}}}
Raw Slogan: {{{rawSlogan}}}

Rewrite this into a vibe-checked student version.`,
});

const optimizeAdCreativeFlow = ai.defineFlow(
  {
    name: 'optimizeAdCreativeFlow',
    inputSchema: OptimizeAdCreativeInputSchema,
    outputSchema: OptimizeAdCreativeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);