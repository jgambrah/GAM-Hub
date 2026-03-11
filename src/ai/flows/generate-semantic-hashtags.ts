'use server';
/**
 * @fileOverview Liaison Semantic Hashtag Engine.
 * 
 * - generateSemanticHashtags - Analyzes post content to suggest relevant campus tags.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const HashtagInputSchema = z.object({
  content: z.string().describe('The content of the post to analyze.'),
  campusAcronym: z.string().optional().describe('The campus context for specific tagging.'),
});

const HashtagOutputSchema = z.object({
  tags: z.array(z.string()).describe('A list of suggested hashtags without the # symbol.'),
});

export async function generateSemanticHashtags(input: z.infer<typeof HashtagInputSchema>) {
  return generateSemanticHashtagsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSemanticHashtagsPrompt',
  input: {schema: HashtagInputSchema},
  output: {schema: HashtagOutputSchema},
  prompt: `You are the Liaison Semantic Indexer for GAM Hub, a campus platform in Ghana.

Your task is to analyze the following post content and generate 3 to 5 highly relevant hashtags that would improve content discovery.

POST CONTENT:
"{{{content}}}"

CAMPUS CONTEXT:
{{#if campusAcronym}}{{{campusAcronym}}}{{else}}General National Hub{{/if}}

GUIDELINES:
1. Return ONLY the tag strings (no # symbol).
2. Use lowercase.
3. Include at least one campus-specific tag if the campus is known (e.g., if campus is KNUST, use 'knust').
4. Include categorical tags (e.g., 'campuslife', 'academic', 'nightlife', 'food', 'marketplace').
5. Use localized Ghanaian student slang tags if relevant (e.g., 'vibe', 'chale', 'yard').
6. Do not repeat tags that might already be in the content.`,
});

const generateSemanticHashtagsFlow = ai.defineFlow(
  {
    name: 'generateSemanticHashtagsFlow',
    inputSchema: HashtagInputSchema,
    outputSchema: HashtagOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
