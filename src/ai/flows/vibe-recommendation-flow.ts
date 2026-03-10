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
  prompt: `You are the Liaison Vibe Matcher, an elite discovery engine for Ghanaian campus life. 
Your goal is to sustain the Yard's frequency by picking the perfect "Next Vibe" from millions of potential candidates.

Analyze the current vibration:
"{{{currentPostContent}}}"

Student Interests (Historical Profile):
{{#each userInterests}}- {{{this}}}{{/each}}

Candidate Pool (Pre-ranked by Profile relevance):
{{#each availablePosts}}- ID: {{{this.id}}} | CONTENT: {{{this.content}}} | TAGS: {{#each this.tags}}{{{this}}}, {{/each}}{{/each}}

Your Mission:
1. Identify the core "Mood" of the current post (e.g., Party/Hype, Studying/Lofi, Flex/Drip, or General Social).
2. Rank the top 5 candidates that best continue this specific narrative or mood.
3. Prioritize "Vibe Consistency" — if they are listening to Afrobeats, don't jump to a sad exam post.
4. If the student has strong historical interests, use them as a "tie-breaker" for ranking.

Output exactly 5 Post IDs in the recommended order.

Tone: Professional, analytic, but deeply tuned to the Yard's high-frequency signals.`,
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
