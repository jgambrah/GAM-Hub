
'use server';
/**
 * @fileOverview Liaison AI Arena Referee - Wit and Justice for the Battleground.
 *
 * - getBattleVerdict - Function to analyze a shade thread and deliver a verdict.
 * - RefereeInput - Input schema containing original post and comebacks.
 * - RefereeOutput - Structured verdict output.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RefereeInputSchema = z.object({
  originalShade: z.string().describe('The content of the original shade post.'),
  comebacks: z.array(z.string()).describe('A list of comebacks from the community.'),
  originalCampus: z.string().describe('The acronym of the campus that started the shade.'),
  targetCampus: z.string().optional().describe('The acronym of the target campus if specified.'),
});
export type RefereeInput = z.infer<typeof RefereeInputSchema>;

const RefereeOutputSchema = z.object({
  verdict: z.string().describe('The witty, high-fidelity AI verdict on the exchange.'),
  burnLevel: z.number().min(1).max(10).describe('The intensity of the burn (1-10).'),
  winner: z.enum(['original', 'comeback', 'draw']).describe('Who won the exchange.'),
  refereeAdvice: z.string().describe('A final piece of witty advice from the AI Referee.'),
});
export type RefereeOutput = z.infer<typeof RefereeOutputSchema>;

export async function getBattleVerdict(input: RefereeInput): Promise<RefereeOutput> {
  return arenaRefereeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'arenaRefereePrompt',
  input: {schema: RefereeInputSchema},
  output: {schema: RefereeOutputSchema},
  prompt: `You are the Official Liaison AI Arena Referee for GAM Hub, the ultimate authority on campus wit in Ghana.

Analyze this battle from the Yard:

ORIGINAL SHADE from {{{originalCampus}}}:
"{{{originalShade}}}"

TARGET CAMPUS: {{#if targetCampus}}{{{targetCampus}}}{{else}}All Rivals{{/if}}

COMMUNITY COMEBACKS:
{{#each comebacks}}
- "{{this}}"
{{/each}}

Your mission is to deliver a "Final Verdict" that determines who won the exchange.
1. **The Verdict**: A sharp, witty, and culturally relevant summary of the battle. Use Ghanaian student context (e.g., GPA stress, hostel life, canteen food).
2. **Burn Level**: Rate the intensity from 1 (mild roast) to 10 (absolute incineration).
3. **Winner**: Choose 'original' if the shade was too strong, 'comeback' if the community successfully retaliated, or 'draw' if it was a mutual incineration.
4. **Referee's Advice**: A closing witty remark using student slang (e.g., "Chale, go back to the drawing board", "No stories, just pure vibes").

Tone: Sharp, humorous, authoritative, and deeply rooted in Ghanaian university culture.`,
});

const arenaRefereeFlow = ai.defineFlow(
  {
    name: 'arenaRefereeFlow',
    inputSchema: RefereeInputSchema,
    outputSchema: RefereeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
