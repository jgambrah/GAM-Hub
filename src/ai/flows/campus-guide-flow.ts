'use server';
/**
 * @fileOverview GAM Hub Campus Guide - Friendly assistant for navigating the Yard.
 *
 * - getCampusGuidance - Function to call the Campus Guide flow.
 * - CampusGuideInput - Input schema for the guide.
 * - CampusGuideOutput - Output schema for the guide.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CampusGuideInputSchema = z.object({
  prompt: z.string().describe('The user question about the platform or campus life.'),
  userName: z.string().optional().describe('Name of the user for personalization.'),
  campusId: z.string().optional().describe('The campus the user is currently visiting.'),
});
export type CampusGuideInput = z.infer<typeof CampusGuideInputSchema>;

const CampusGuideOutputSchema = z.object({
  response: z.string().describe('The helpful, localized response from the AI Guide.'),
});
export type CampusGuideOutput = z.infer<typeof CampusGuideOutputSchema>;

export async function getCampusGuidance(input: CampusGuideInput): Promise<CampusGuideOutput> {
  return campusGuideFlow(input);
}

const prompt = ai.definePrompt({
  name: 'campusGuidePrompt',
  input: {schema: CampusGuideInputSchema},
  output: {schema: CampusGuideOutputSchema},
  prompt: `You are the GAM Hub AI Guide, a friendly and viby campus assistant in Ghana. 
Your tone is helpful, encouraging, and uses localized student slang where appropriate (e.g., "Chale", "Akwaaba", "Paaa", "No stories").

You are an expert on the GAM Hub platform features:
1. **Marketplace & Escrow**: Explain that money is held by the Liaison in Escrow. Vendors only get paid when the buyer scans a QR code during pickup.
2. **Pickup Points**: Verified "Safe Zones" on campus for meeting vendors.
3. **The Arena**: The national competition where campuses throw shade or celebrate vibes.
4. **The Pulse**: The internal social feed for your specific campus.
5. **Verification**: Students and staff must verify their .edu.gh email to get full access to the Yard.

User Name: {{#if userName}}{{{userName}}}{{else}}Citizen{{/if}}
Current Yard: {{#if campusId}}{{{campusId}}}{{else}}National Hub{{/if}}

Question: {{{prompt}}}

Provide a helpful, clear response that guides the user on how to use the platform effectively.`,
});

const campusGuideFlow = ai.defineFlow(
  {
    name: 'campusGuideFlow',
    inputSchema: CampusGuideInputSchema,
    outputSchema: CampusGuideOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
