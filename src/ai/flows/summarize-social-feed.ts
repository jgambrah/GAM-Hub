'use server';

/**
 * @fileOverview Summarizes the most popular or relevant content from a campus social feed.
 *
 * - summarizeSocialFeed - A function that handles the summarization process.
 * - SummarizeSocialFeedInput - The input type for the summarizeSocialFeed function.
 * - SummarizeSocialFeedOutput - The return type for the summarizeSocialFeed function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeSocialFeedInputSchema = z.object({
  campusId: z
    .string()
    .describe('The ID of the campus whose social feed is to be summarized.'),
  socialFeedContent: z
    .string()
    .describe('The concatenated content of the social feed to be summarized.'),
});
export type SummarizeSocialFeedInput = z.infer<typeof SummarizeSocialFeedInputSchema>;

const SummarizeSocialFeedOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A concise summary of the most popular or relevant content from the campus social feed.'
    ),
});
export type SummarizeSocialFeedOutput = z.infer<typeof SummarizeSocialFeedOutputSchema>;

export async function summarizeSocialFeed(input: SummarizeSocialFeedInput): Promise<SummarizeSocialFeedOutput> {
  return summarizeSocialFeedFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeSocialFeedPrompt',
  input: {schema: SummarizeSocialFeedInputSchema},
  output: {schema: SummarizeSocialFeedOutputSchema},
  prompt: `You are a social media manager for a university campus. Your job is to provide students with the most relevant information from their campus social feed.

  Summarize the following social feed content from campus ID {{{campusId}}}. Only include the most important information, events, and discussions. Make the summary concise and easy to read.

  Social Feed Content:
  {{socialFeedContent}}`,
});

const summarizeSocialFeedFlow = ai.defineFlow(
  {
    name: 'summarizeSocialFeedFlow',
    inputSchema: SummarizeSocialFeedInputSchema,
    outputSchema: SummarizeSocialFeedOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
