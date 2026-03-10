'use server';
/**
 * @fileOverview Liaison Vibe-Matcher - Intelligent music and video recommendations.
 *
 * - getRecommendedVibes - Recommends the next vibes to play based on user interests and current content.
 * - VibeMatchInput - Content of current post + list of candidates.
 * - VibeMatchOutput - Ranked list of post IDs for continuous playback.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VibeMatchInputSchema = z.object({
  currentPostContent: z.string().describe('The content/caption of the video being watched.'),
  userInterests: z.array(z.string()).describe('The user\'s interests from their profile.'),
  availablePosts: z.array(z.object({
    id: z.string(),
    content: z.string(),
    tags: z.array(z.string()).optional(),
  })).describe('The pool of other vibrations available in the Yard.'),
});

const VibeMatchOutputSchema = z.object({
  recommendedPostIds: z.array(z.string()).describe('The top IDs recommended for autoplay in order.'),
  reasoning: z.string().describe('Brief explanation of why these vibes match.'),
});

export async function getRecommendedVibes(input: z.infer<typeof VibeMatchInputSchema>): Promise<z.infer<typeof VibeMatchOutputSchema>> {
  return vibeMatchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'vibeMatchPrompt',
  input: {schema: VibeMatchInputSchema},
  output: {schema: VibeMatchOutputSchema},
  prompt: `You are the Liaison Vibe Matcher.

Goal: continue the emotional and musical narrative of the current post.

Current Post:
"{{{currentPostContent}}}"

User Interests:
{{#each userInterests}}
- {{{this}}}
{{/each}}

Candidate Posts:
{{#each availablePosts}}
ID: {{{this.id}}}
Content: {{{this.content}}}
Tags: {{#each this.tags}}{{{this}}}, {{/each}}

{{/each}}

Ranking priorities (most important first):

1. Mood continuity
2. Tag similarity
3. User interests
4. Campus relevance
5. Freshness

Return the best 5 IDs in ranked order.

Do not invent IDs.
Return only IDs from the candidate list.`,
});

const vibeMatchFlow = ai.defineFlow(
  {
    name: 'vibeMatchFlow',
    inputSchema: VibeMatchInputSchema,
    outputSchema: VibeMatchOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
