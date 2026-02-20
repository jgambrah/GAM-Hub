'use server';

/**
 * @fileOverview A personalized product recommendation AI agent.
 *
 * - getPersonalizedProductRecommendations - A function that generates personalized product recommendations.
 * - PersonalizedProductRecommendationsInput - The input type for the getPersonalizedProductRecommendations function.
 * - PersonalizedProductRecommendationsOutput - The return type for the getPersonalizedProductRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalizedProductRecommendationsInputSchema = z.object({
  userId: z.string().describe('The ID of the user.'),
  campusId: z.string().describe('The ID of the campus the user belongs to.'),
  role: z.enum(['student', 'staff']).describe('The role of the user (student or staff).'),
  majorOrDepartment: z.string().optional().describe("The user's major (if student) or department (if staff)."),
  interests: z.array(z.string()).optional().describe("A list of the user's interests."),
  purchaseHistory: z.array(z.string()).describe('List of product IDs the user has purchased.'),
  productCatalog: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    description: z.string(),
    category: z.string(),
    targetAudience: z.enum(['all', 'student', 'staff']),
  })).describe('The product catalog to select recommendations from.'),
});
export type PersonalizedProductRecommendationsInput = z.infer<typeof PersonalizedProductRecommendationsInputSchema>;

const PersonalizedProductRecommendationsOutputSchema = z.object({
  recommendations: z.array(z.string()).describe('A list of product IDs that are recommended for the user.'),
});
export type PersonalizedProductRecommendationsOutput = z.infer<typeof PersonalizedProductRecommendationsOutputSchema>;

export async function getPersonalizedProductRecommendations(input: PersonalizedProductRecommendationsInput): Promise<PersonalizedProductRecommendationsOutput> {
  return personalizedProductRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizedProductRecommendationsPrompt',
  input: {schema: PersonalizedProductRecommendationsInputSchema},
  output: {schema: PersonalizedProductRecommendationsOutputSchema},
  prompt: `You are an expert recommendation system for a multi-university platform in Ghana called GAM Hub. Your task is to provide personalized product recommendations to university members.

The user can be a 'student' or a 'staff' member. Your recommendations must respect the 'targetAudience' of each product. Staff can see 'all' and 'staff' products. Students can see 'all' and 'student' products.

Based on the user's profile and the available product catalog, provide a list of product IDs that would be most relevant. Prioritize items that align with their role, academic focus, and interests. For staff, also consider recommending higher-value items or exclusive deals (like insurance, land, car deals if available in the catalog).

User Profile:
- User ID: {{{userId}}}
- Campus ID: {{{campusId}}}
- Role: {{{role}}}
- Academic Focus: {{#if majorOrDepartment}}{{{majorOrDepartment}}}{{else}}Not specified{{/if}}
- Interests: {{#if interests}}{{#each interests}}{{{this}}}, {{/each}}{{else}}Not specified{{/if}}
- Purchase History: {{#if purchaseHistory}}{{#each purchaseHistory}}{{{this}}}, {{/each}}{{else}}No purchase history{{/if}}

Product Catalog (with target audience):
{{#each productCatalog}}
- {{{this.productId}}}: {{{this.name}}} (Category: {{{this.category}}}, Audience: {{{this.targetAudience}}})
{{/each}}

Provide a list of recommended product IDs.`,
});

const personalizedProductRecommendationsFlow = ai.defineFlow(
  {
    name: 'personalizedProductRecommendationsFlow',
    inputSchema: PersonalizedProductRecommendationsInputSchema,
    outputSchema: PersonalizedProductRecommendationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
