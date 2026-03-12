
'use server';
/**
 * @fileOverview AI Recommendation Reason Generator.
 * Explains why a product matches a user's shopping intent.
 * 
 * - generateRecommendationReason - Function to call the explainer flow.
 * - ExplainInput - Input schema for context.
 * - ExplainOutput - Structured reasons.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  productPrice: z.number().describe('The price in GHS.'),
  productRating: z.number().optional().describe('Average customer rating.'),
  userQuery: z.string().describe('The natural language query used to search.'),
});
export type ExplainInput = z.infer<typeof ExplainInputSchema>;

const ExplainOutputSchema = z.object({
  reasons: z.array(z.string()).describe('Exactly 2 short reasons why this matches.'),
});
export type ExplainOutput = z.infer<typeof ExplainOutputSchema>;

export async function generateRecommendationReason(input: ExplainInput): Promise<ExplainOutput> {
  return explainRecommendationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainRecommendationPrompt',
  input: {schema: ExplainInputSchema},
  output: {schema: ExplainOutputSchema},
  prompt: `You are the Liaison Marketplace Assistant at GAM Hub, a campus platform in Ghana.

Your task is to explain to a student or staff member why the following product matches their query.

USER QUERY: "{{{userQuery}}}"

PRODUCT CONTEXT:
- Name: {{{productName}}}
- Price: GHS {{{productPrice}}}
- Rating: {{#if productRating}}{{{productRating}}}{{else}}5.0{{/if}}

GOAL:
Provide exactly 2 short, bullet-point reasons.
Focus on:
1. Relevance to the intent (e.g., "Perfect for study sessions").
2. Value (e.g., "Matches your affordable budget").
3. Trust (e.g., "Highly rated by fellow students").

Tone: Helpful, student-centric, and concise (max 10 words per reason).`,
});

const explainRecommendationFlow = ai.defineFlow(
  {
    name: 'explainRecommendationFlow',
    inputSchema: ExplainInputSchema,
    outputSchema: ExplainOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
