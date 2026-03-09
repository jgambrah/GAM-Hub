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
  prompt: `You are the Liaison Vibe Matcher, an expert in Ghanaian campus trends, Afrobeats, Highlife, and student lifestyle.

Analyze the current video vibration:
"{{{currentPostContent}}}"

User Interests:
{{#each userInterests}}- {{{this}}}{{/each}}

Candidate Vibrations:
{{#each availablePosts}}- ID: {{{this.id}}} | CONTENT: {{{this.content}}} | TAGS: {{#each this.tags}}{{{this}}}, {{/each}}{{/each}}

Your Mission:
1. Identify if the current video is music (look for artist names, song titles, or music emojis).
2. Find similar music or content from the candidate list. Prioritize the same artist, similar genre, or same campus vibe.
3. Factor in the user's interests to refine the ranking.
4. Return the top 5 Post IDs that should play next in a continuous stream.

Tone: Professional, analytic, but deeply tuned to the Yard's frequency.`,
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
