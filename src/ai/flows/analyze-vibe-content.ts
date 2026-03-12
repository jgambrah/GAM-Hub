
'use server';
/**
 * @fileOverview Liaison AI Content Understanding Engine.
 * Analyzes video/audio/text to extract deep cultural and semantic metadata.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeVibeInputSchema = z.object({
  mediaUrl: z.string().describe('The URL of the media (video or image) to analyze.'),
  caption: z.string().optional().describe('The user provided caption for context.'),
  mediaType: z.enum(['video', 'image', 'youtube', 'tiktok']).describe('Type of media being analyzed.'),
});
export type AnalyzeVibeInput = z.infer<typeof AnalyzeVibeInputSchema>;

const AnalyzeVibeOutputSchema = z.object({
  aiTags: z.array(z.string()).describe('Auto-detected hashtags (lowercase, no #).'),
  aiTopics: z.array(z.string()).describe('Broad topics detected (e.g., Music, Study, Sports, Food).'),
  mood: z.string().describe('The emotional vibe or mood of the content (e.g., hype, chill, aggressive).'),
  musicGenre: z.string().optional().describe('Detected music genre if applicable.'),
  detectedObjects: z.array(z.string()).describe('List of key visual objects or scenes detected.'),
  transcript: z.string().optional().describe('Summary transcript of speech if detected.'),
});
export type AnalyzeVibeOutput = z.infer<typeof AnalyzeVibeOutputSchema>;

export async function analyzeVibeContent(input: AnalyzeVibeInput): Promise<AnalyzeVibeOutput> {
  return analyzeVibeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeVibePrompt',
  input: {schema: AnalyzeVibeInputSchema},
  output: {schema: AnalyzeVibeOutputSchema},
  prompt: `You are the Liaison AI Content Architect for GAM Hub, a multi-university platform in Ghana.

Your mission is to perform a "Deep Vibe Audit" on the following content shared in the Yard.

USER CONTEXT:
Caption: "{{{caption}}}"
Media Type: {{{mediaType}}}
Media Link: {{{mediaUrl}}}

ANALYSIS GOALS:
1. **Semantic Hashtags**: Generate 3-5 relevant hashtags that the user might have missed. Focus on campus context, major, or activity.
2. **Thematic Topics**: Identify broad topics like "Academic Excellence", "Night Market Vibes", "Hostel Life", or "National Pride".
3. **Mood Signature**: Detect the emotional frequency (e.g., hype, serene, stress, victory).
4. **Detected Objects**: List the key visual elements (e.g., "Library", "Afrobeats Dance", "Kenkey Party").
5. **Cultural Context**: Use your knowledge of Ghanaian university culture (UG, KNUST, etc.) to detect specific local references.

Return a high-fidelity metadata profile for this vibration.`,
});

const analyzeVibeFlow = ai.defineFlow(
  {
    name: 'analyzeVibeFlow',
    inputSchema: AnalyzeVibeInputSchema,
    outputSchema: AnalyzeVibeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
