
'use server';
/**
 * @fileOverview Liaison AI Demand Intent Parser.
 * Converts natural language marketplace requests into structured supply signals.
 *
 * - parseDemandRequest - Entry point for extracting intent from requests.
 * - DemandInput - Input schema.
 * - DemandOutput - Structured metadata.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DemandInputSchema = z.object({
  query: z.string().describe('The student\'s natural language shopping request.'),
});
export type DemandInput = z.infer<typeof DemandInputSchema>;

const DemandOutputSchema = z.object({
  category: z.string().describe('The identified product category (electronics, fashion, food, stationery, services, home, health).'),
  tags: z.array(z.string()).describe('Specific keywords describing the item.'),
  condition: z.enum(['new', 'used', 'any']).describe('The requested condition of the item.'),
});
export type DemandOutput = z.infer<typeof DemandOutputSchema>;

export async function parseDemandRequest(input: DemandInput): Promise<DemandOutput> {
  return parseDemandRequestFlow(input);
}

const prompt = ai.definePrompt({
  name: 'parseDemandRequestPrompt',
  input: {schema: DemandInputSchema},
  output: {schema: DemandOutputSchema},
  prompt: `You are the Liaison AI Supply-Demand Architect for GAM Hub in Ghana.

Extract structured shopping intent from the following student request.

REQUEST:
"${{query}}"

ANALYSIS GOALS:
1. **Category**: Select the best match from: electronics, fashion, food, stationery, services, home, health.
2. **Tags**: Extract exactly 2-4 keywords that a vendor would use to identify the item.
3. **Condition**: Detect if the user specified "new" or "used". If not specified, return "any".

Return the structured metadata profile.`,
});

const parseDemandRequestFlow = ai.defineFlow(
  {
    name: 'parseDemandRequestFlow',
    inputSchema: DemandInputSchema,
    outputSchema: DemandOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
