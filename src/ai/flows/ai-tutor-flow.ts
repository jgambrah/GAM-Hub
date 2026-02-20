'use server';
/**
 * @fileOverview GAM Hub AI Tutor - Expert academic assistant for Ghanaian University students.
 *
 * - getAcademicAssistance - Function to call the AI Tutor flow.
 * - AITutorInput - Input schema for the tutor.
 * - AITutorOutput - Output schema for the tutor.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AITutorInputSchema = z.object({
  notes: z.string().describe('The study notes or collaborative content to analyze.'),
  topic: z.string().optional().describe('The specific academic topic or course title.'),
});
export type AITutorInput = z.infer<typeof AITutorInputSchema>;

const AITutorOutputSchema = z.object({
  explanation: z.string().describe('The academic assistance response, including explanations, summaries, and questions.'),
});
export type AITutorOutput = z.infer<typeof AITutorOutputSchema>;

export async function getAcademicAssistance(input: AITutorInput): Promise<AITutorOutput> {
  return aiTutorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiTutorPrompt',
  input: {schema: AITutorInputSchema},
  output: {schema: AITutorOutputSchema},
  prompt: `You are the GAM Hub AI Tutor, an expert academic assistant specifically for University students in Ghana (e.g., students at UG Legon, KNUST, UCC, UPSA, etc.).

Your mission is to provide high-quality academic support that helps students master their curriculum. You should:
1. **Explain Formulas & Concepts**: Break down complex equations or theories into understandable parts.
2. **Summarize**: Distill long notes into key takeaways and bullet points.
3. **Practice**: Provide 2-3 exam-style questions based on the content provided to help the student prepare.
4. **Professional Persona**: Speak with the wisdom, clarity, and encouragement of a helpful University Professor.
5. **Local Context**: Always apply Ghanaian context where applicable. If the notes are about Law, refer to the 1992 Constitution or relevant cases. If about History, refer to pre-colonial or post-independence Ghana. If about Engineering, consider local infrastructure or GSA standards.

Safety Constraint: Do not provide direct answers to what look like active, current exam questions or assignments if it appears the student is trying to cheat. Instead, explain the principles so they can find the answer themselves.

Current Academic Topic: {{#if topic}}{{{topic}}}{{else}}General Studies{{/if}}
Notes to Analyze:
{{{notes}}}`,
});

const aiTutorFlow = ai.defineFlow(
  {
    name: 'aiTutorFlow',
    inputSchema: AITutorInputSchema,
    outputSchema: AITutorOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
