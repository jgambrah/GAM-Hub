'use server';
/**
 * @fileOverview Liaison AI Campus Mood Interpreter.
 * Analyzes real-time trend patterns to define the collective "vibe" of the Yard.
 *
 * - analyzeCampusMood - Function to call the mood analysis flow.
 * - CampusMoodInput - Input schema containing trend weights.
 * - CampusMoodOutput - Structured mood profile.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CampusMoodInputSchema = z.object({
  trends: z.record(z.number()).describe('A map of hashtags/entities to their current hourly weights.'),
});
export type CampusMoodInput = z.infer<typeof CampusMoodInputSchema>;

const CampusMoodOutputSchema = z.object({
  moodTitle: z.string().describe('A short, catchy name for the current mood (e.g. Exam Fever, Party Weekend).'),
  description: z.string().describe('A 1-2 sentence description of what the campus is doing based on trends.'),
  advice: z.string().describe('A piece of wisdom or encouragement from the Liaison for this specific mood.'),
  visualVibe: z.enum(['calm', 'energetic', 'stressed', 'celebratory', 'commercial']).describe('The general visual category of the mood.'),
});
export type CampusMoodOutput = z.infer<typeof CampusMoodOutputSchema>;

export async function analyzeCampusMood(input: CampusMoodInput): Promise<CampusMoodOutput> {
  return campusMoodFlow(input);
}

const prompt = ai.definePrompt({
  name: 'campusMoodPrompt',
  input: {schema: CampusMoodInputSchema},
  output: {schema: CampusMoodOutputSchema},
  prompt: `You are the Liaison AI Mood Architect for GAM Hub, a multi-university platform in Ghana.
  
Analyze the following real-time trend data (hashtags and entity frequencies) from the Yard:

TREND DATA:
{{#each trends}}
- {{@key}}: {{this}}
{{/each}}

Your task is to interpret these signals to determine the collective campus "state" or "mood". 
Consider Ghanaian university culture (UG Legon, KNUST, UCC, etc.):
- High academic/study tags = Exam season or Matriculation.
- High music/vibe/party tags = Social peaks or Weekend energy.
- High product/deal/momo tags = A commerce wave or market surge.

Provide a high-fidelity mood profile that helps students and staff understand the current campus frequency.
Tone: Viby, professional, and culturally relevant. Use student slang like "Chale" or "Paaa" very sparingly for flavor.`,
});

const campusMoodFlow = ai.defineFlow(
  {
    name: 'campusMoodFlow',
    inputSchema: CampusMoodInputSchema,
    outputSchema: CampusMoodOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
