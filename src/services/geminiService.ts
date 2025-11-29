/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import {GoogleGenAI} from '@google/genai';

// This check is for development-time feedback.
if (!process.env.API_KEY) {
  console.error(
    'API_KEY environment variable is not set. The application will not be able to connect to the Gemini API.',
  );
}

// FIX: Initialize GoogleGenAI according to guidelines, without non-null assertion.
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const textModelName = 'gemini-flash-lite-latest';
const searchModelName = 'gemini-2.5-flash';

// FIX: Export missing AsciiArtData interface.
export interface AsciiArtData {
  art: string;
  text?: string;
}

export type StreamEvent = 
  | { type: 'chunk'; text: string }
  | { type: 'error'; message: string };

/**
 * Streams a definition for a given topic from the Gemini API.
 * @param topic The word or term to define.
 * @returns An async generator that yields structured event objects.
 */
export async function* streamWikiDefinition(
  topic: string,
): AsyncGenerator<StreamEvent, void, undefined> {
  // FIX: Remove redundant API key check, assuming it's configured as per guidelines.
  const prompt = `Provide a concise, single-paragraph encyclopedia-style definition for the term: "${topic}". Be informative and neutral. Do not use markdown, titles, or any special formatting. Respond with only the text of the definition itself.`;
  const config = { thinkingConfig: { thinkingBudget: 0 } };

  try {
    const result = await ai.models.generateContentStream({
      model: textModelName,
      contents: prompt,
      config: config,
    });

    for await (const chunk of result) {
      if (chunk.text) {
        yield { type: 'chunk', text: chunk.text };
      }
    }
  } catch (error) {
    console.error('Error streaming from Gemini:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    yield { type: 'error', message: `Could not generate content for "${topic}". ${errorMessage}`};
    throw new Error(errorMessage);
  }
}

/**
 * Streams an answer to a query based on the content of a provided document.
 * @param query The user's question.
 * @param documentContext The text of the document to search within.
 * @returns An async generator yielding stream events.
 */
export async function* streamInDocumentQuery(
  query: string,
  documentContext: string,
): AsyncGenerator<StreamEvent, void, undefined> {
  // FIX: Remove redundant API key check, assuming it's configured as per guidelines.
  const prompt = `Based *only* on the content of the following document, answer the user's question: "${query}". Provide a comprehensive answer, quoting from the text if relevant. If the answer is not available in the document, state that the information is not available in the provided text. Do not use any outside knowledge.

DOCUMENT:
---
${documentContext}
---

ANSWER FOR "${query}":`;

  try {
    const result = await ai.models.generateContentStream({
      model: textModelName,
      contents: prompt,
    });

    for await (const chunk of result) {
      if (chunk.text) {
        yield { type: 'chunk', text: chunk.text };
      }
    }
  } catch (error) {
    console.error('Error streaming from Gemini:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    yield { type: 'error', message: `Could not answer question "${query}". ${errorMessage}`};
    throw new Error(errorMessage);
  }
}


interface AiSearchResult {
  content: string;
  sources: any[];
}

/**
 * Performs a search for a given question using Google Search grounding.
 * This is non-streaming to ensure grounding data is retrieved reliably.
 * @param question The user's question.
 * @returns A promise that resolves to an object with the content and sources.
 */
export async function performAiSearch(question: string): Promise<AiSearchResult> {
  // FIX: Remove redundant API key check, assuming it's configured as per guidelines.
  try {
    const response = await ai.models.generateContent({
      model: searchModelName,
      contents: question,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

    // FIX: Directly access response.text as per guidelines.
    const content = response.text;
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    return { content, sources };

  } catch (error) {
    console.error('Error during AI search:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    throw new Error(`Could not complete search for "${question}". ${errorMessage}`);
  }
}
