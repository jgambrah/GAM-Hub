
'use server';
/**
 * @fileOverview Liaison AI Market Intent Parser.
 * Converts natural language shopping queries into structured search parameters.
 *
 * - parseMarketIntent - Entry point for parsing queries.
 * - MarketIntentInput - Input schema.
 * - MarketIntentOutput - Structured search output.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { MarketIntent } from '@/lib/types';

const MarketIntentInputSchema = z.object({
  query: z.string().describe('The user\'s natural language shopping query.'),
});
export type MarketIntentInput = z.infer<typeof MarketIntentInputSchema>;

const MarketIntentOutputSchema = z.object({
  category: z.string().optional().describe('The identified product category (electronics, fashion, food, stationery, services, home, health).'),
  tags: z.array(z.string()).optional().describe('Specific product keywords extracted from the query.'),
  priceMin: z.number().optional().describe('The minimum budget specified in GHS.'),
  priceMax: z.number().optional().describe('The maximum budget specified in GHS.'),
  intent: z.string().optional().describe('The primary intent or use case (e.g., study, gym, party).'),
});

export async function parseMarketIntent(input: MarketIntentInput): Promise<MarketIntent> {
  return marketIntentParserFlow(input);
}

const prompt = ai.definePrompt({
  name: 'marketIntentParserPrompt',
  input: {schema: MarketIntentInputSchema},
  output: {schema: MarketIntentOutputSchema},
  prompt: `You are the Liaison AI Shopping Assistant for GAM Hub, a campus marketplace in Ghana.

Your task is to take a student or staff member's shopping query and convert it into structured search fields for our database.

USER QUERY: "{{{query}}}"

ANALYSIS RULES:
1. **Category**: Match to one of: electronics, fashion, food, stationery, services, home, health.
2. **Tags**: Extract specific product types (e.g., "sneakers", "macbook", "kenkey").
3. **Price Limits**: 
   - If they mention "cheap" or "affordable", set priceMax to a reasonable student budget for that category (e.g. 100 for food, 500 for clothes, 3000 for laptops).
   - If they specify "under X", set priceMax to X.
   - If they say "between X and Y", set both priceMin and priceMax.
4. **Intent**: Identify the context (e.g., "study", "exam prep", "gym", "hostel life", "party").

Return the structured intent profile.`,
});

const marketIntentParserFlow = ai.defineFlow(
  {
    name: 'marketIntentParserFlow',
    inputSchema: MarketIntentInputSchema,
    outputSchema: MarketIntentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
