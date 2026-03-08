'use server';
/**
 * @fileOverview Departmental Daily Briefing Flow - AI Professor expansion.
 *
 * - getAcademicDailyBriefing - Function to aggregate and summarize departmental activity.
 * - AcademicSummaryInput - Input schema containing major and room data.
 * - AcademicSummaryOutput - Structured briefing output.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AcademicSummaryInputSchema = z.object({
  major: z.string().describe('The academic department or major to summarize.'),
  roomData: z.string().describe('Concatenated titles and content snippets from active study rooms.'),
});
export type AcademicSummaryInput = z.infer<typeof AcademicSummaryInputSchema>;

const AcademicSummaryOutputSchema = z.object({
  summary: z.string().describe('A cohesive briefing of today\'s academic focus.'),
  hotTopics: z.array(z.string()).describe('The top 3 specific topics being discussed or studied.'),
  profAdvice: z.string().describe('A piece of wisdom or advice from the AI Professor tailored to the day\'s activity.'),
});
export type AcademicSummaryOutput = z.infer<typeof AcademicSummaryOutputSchema>;

export async function getAcademicDailyBriefing(input: AcademicSummaryInput): Promise<AcademicSummaryOutput> {
  return academicDailyBriefingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'academicDailyBriefingPrompt',
  input: {schema: AcademicSummaryInputSchema},
  output: {schema: AcademicSummaryOutputSchema},
  prompt: `You are the Head AI Professor at GAM Hub, an expert academic authority for Ghanaian universities.

Analyze the following collective academic activity from the {{{major}}} department today:

ACTIVITY LOG:
{{{roomData}}}

Your mission is to provide a "Daily Departmental Briefing" that helps students stay in sync with their peers.
1. **The Briefing**: Summarize what the department is focusing on collectively.
2. **Hot Topics**: Identify exactly 3 trending academic topics or challenges found in the notes.
3. **Prof's Advice**: Provide a helpful, encouraging, and slightly formal piece of advice (Professor persona) based on this activity. Apply Ghanaian context (e.g. exams, curriculum, local standards) where relevant.

Tone: Professional, wise, and encouraging. Use "Chale" or local student slang only very sparingly to maintain the "Professor" authority.`,
});

const academicDailyBriefingFlow = ai.defineFlow(
  {
    name: 'academicDailyBriefingFlow',
    inputSchema: AcademicSummaryInputSchema,
    outputSchema: AcademicSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
