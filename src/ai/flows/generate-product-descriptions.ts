'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating product descriptions using AI.
 *
 * The flow takes product details as input and returns an AI-generated product description.
 * - generateProductDescription - The main function to generate a product description.
 * - GenerateProductDescriptionInput - The input type for the generateProductDescription function.
 * - GenerateProductDescriptionOutput - The return type for the generateProductDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateProductDescriptionInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  productCategory: z.string().describe('The category of the product (e.g., electronics, clothing).'),
  keyFeatures: z.string().describe('A comma-separated list of key features of the product.'),
  targetAudience: z.string().describe('The target audience for the product (e.g., students, professionals).'),
});
export type GenerateProductDescriptionInput = z.infer<typeof GenerateProductDescriptionInputSchema>;

const GenerateProductDescriptionOutputSchema = z.object({
  description: z.string().describe('The AI-generated product description.'),
});
export type GenerateProductDescriptionOutput = z.infer<typeof GenerateProductDescriptionOutputSchema>;

export async function generateProductDescription(
  input: GenerateProductDescriptionInput
): Promise<GenerateProductDescriptionOutput> {
  return generateProductDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProductDescriptionPrompt',
  input: {schema: GenerateProductDescriptionInputSchema},
  output: {schema: GenerateProductDescriptionOutputSchema},
  prompt: `You are an expert copywriter specializing in creating compelling product descriptions.

  Based on the following product details, generate a captivating and informative product description that will entice customers to purchase the product.

  Product Name: {{productName}}
  Product Category: {{productCategory}}
  Key Features: {{keyFeatures}}
  Target Audience: {{targetAudience}}

  Write a description that highlights the product's benefits and appeals to the target audience. Keep it concise and engaging.
  `,
});

const generateProductDescriptionFlow = ai.defineFlow(
  {
    name: 'generateProductDescriptionFlow',
    inputSchema: GenerateProductDescriptionInputSchema,
    outputSchema: GenerateProductDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
