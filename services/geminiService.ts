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

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const textModelName = 'gemini-2.5-flash';
const searchModelName = 'gemini-2.5-flash';
const imageModelName = 'gemini-2.5-flash-image';

export interface AsciiArtData {
  art: string;
  text?: string;
}

export type StreamEvent = 
  | { type: 'chunk'; text: string; sources?: any[] }
  | { type: 'error'; message: string };

/**
 * Streams a definition for a given topic from the Gemini API.
 */
export async function* streamWikiDefinition(
  topic: string,
  language: string = 'English'
): AsyncGenerator<StreamEvent, void, undefined> {
  const prompt = `Using a web search, provide a concise, single-paragraph encyclopedia-style definition for the term: "${topic}". 
  
  Language Requirement: You MUST write your response in ${language}.
  
  Your answer must be based on the most current information available. Be informative and neutral. Do not use markdown, titles, or any special formatting. Respond with only the text of the definition itself.
  
  VISUALS: If this concept is abstract or complex, you MAY insert one [DIAGRAM: description] tag at the end to generate an illustration.`;
  
  const config = { 
    tools: [{googleSearch: {}}],
  };

  try {
    const result = await ai.models.generateContentStream({
      model: searchModelName,
      contents: prompt,
      config: config,
    });

    for await (const chunk of result) {
      const text = chunk.text;
      const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (text || (sources && sources.length > 0)) {
        yield { type: 'chunk', text: text ?? '', sources: sources };
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
 * Streams an answer to a query based on the content of a provided document or file.
 * Accepts either a text string (documentContext) or a base64 file object (fileData).
 */
export async function* streamInDocumentQuery(
  query: string,
  documentContext: string | null,
  fileData?: { mimeType: string; data: string },
  language: string = 'English'
): AsyncGenerator<StreamEvent, void, undefined> {
  let contents: any;

  if (documentContext) {
    // Text-based query (extracted text)
    contents = `Based *only* on the content of the following document, answer the user's question: "${query}". 
    
    Language Requirement: You MUST answer in ${language}.
    
    Provide a comprehensive answer, quoting from the text if relevant. If the answer is not available in the document, state that the information is not available in the provided text. Do not use any outside knowledge.

DOCUMENT:
---
${documentContext}
---

ANSWER FOR "${query}" (in ${language}):`;
  } else if (fileData) {
    // Multimodal query (scanned PDF, image, binary file)
    const isAnalysisRequest = query === 'Analyze Document' || query === 'Read Document';
    const textPrompt = isAnalysisRequest
      ? `Please provide a comprehensive transcription and summary of the text and visual content in this document. Organize it clearly. If it's a scanned text document, simply output the text found within it.
      
      Language Requirement: The summary/transcription MUST be in ${language}.`
      : `Answer the user's question: "${query}" based on the provided document. Respond in ${language}.`;

    contents = {
      parts: [
        {
          inlineData: {
            mimeType: fileData.mimeType,
            data: fileData.data
          }
        },
        {
          text: textPrompt
        }
      ]
    };
  } else {
    throw new Error("No document context or file data provided for query.");
  }

  try {
    const result = await ai.models.generateContentStream({
      model: textModelName,
      contents: contents,
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

/**
 * Streams a direct translation of provided text.
 */
export async function* streamTranslation(
  textToTranslate: string,
  targetLanguage: string
): AsyncGenerator<StreamEvent, void, undefined> {
  const prompt = `Translate the following text into ${targetLanguage}. Maintain the original tone and formatting as much as possible. Do not add conversational filler.
  
  TEXT TO TRANSLATE:
  ${textToTranslate}`;

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
    console.error('Error streaming translation:', error);
    yield { type: 'error', message: `Translation failed. ${error instanceof Error ? error.message : ''}`};
  }
}

/**
 * Streams an answer to a query based on a provided image and optional query.
 */
export async function* streamImageAnalysis(
  query: string,
  base64Image: string,
  mimeType: string,
  language: string = 'English'
): AsyncGenerator<StreamEvent, void, undefined> {
  // If query is the default placeholder, ask for a description/summary
  const isDefault = query === 'Image Analysis';
  const textPrompt = isDefault 
    ? `Analyze this image in detail. Describe the visual elements, the context, and any text present. Provide a comprehensive summary of what is shown. Respond in ${language}.`
    : `${query}. Respond in ${language}.`;

  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType: mimeType,
    },
  };
  const textPart = { text: textPrompt };

  try {
    const result = await ai.models.generateContentStream({
      model: searchModelName,
      contents: { parts: [imagePart, textPart] },
    });

    for await (const chunk of result) {
      if (chunk.text) {
        yield { type: 'chunk', text: chunk.text };
      }
    }
  } catch (error) {
    console.error('Error streaming image analysis:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    yield { type: 'error', message: `Could not analyze image. ${errorMessage}`};
    throw new Error(errorMessage);
  }
}

interface AiSearchResult {
  content: string;
  sources: any[];
}

export async function performAiSearch(question: string, language: string = 'English'): Promise<AiSearchResult> {
  try {
    const prompt = `${question}
    
    Respond in ${language}.`;

    const response = await ai.models.generateContent({
      model: searchModelName,
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

    const content = response.text;
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    return { content: content ?? '', sources };

  } catch (error) {
    console.error('Error during AI search:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    throw new Error(`Could not complete search for "${question}". ${errorMessage}`);
  }
}

/**
 * Streams a summary of a YouTube video from its URL.
 */
export async function* streamYouTubeSummary(
  url: string,
  language: string = 'English'
): AsyncGenerator<StreamEvent, void, undefined> {
  const prompt = `You are an expert video analyst. The user provided this YouTube URL: ${url}.
  
  TASK:
  1. Identify the video title and channel.
  2. Provide a Comprehensive Summary of the video content. Don't just give a teaser; give the actual substance of what was said or shown.
  3. List Key Takeaways or detailed bullet points of the main arguments/events.
  4. If it's a tutorial, list the steps. If it's a news clip, list the facts.
  
  Language Requirement: Write the entire summary in ${language}.
  
  Format the output as a clean, structured article with clear headings (use simple capitalization/bolding, no markdown headers like ##).`;

  const config = { 
    tools: [{googleSearch: {}}],
  };

  try {
    const result = await ai.models.generateContentStream({
      model: searchModelName,
      contents: prompt,
      config: config,
    });

    for await (const chunk of result) {
      const text = chunk.text;
      const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      if (text || (sources && sources.length > 0)) {
        yield { type: 'chunk', text: text ?? '', sources: sources };
      }
    }
  } catch (error) {
    console.error('Error streaming YouTube summary from Gemini:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    yield { type: 'error', message: `Could not generate summary for the video. ${errorMessage}`};
    throw new Error(errorMessage);
  }
}

/**
 * Streams content from a generic web URL (eBooks, articles, etc.) with pagination support.
 */
export async function* streamWebResource(
  url: string,
  sectionIndex: number = 0,
  language: string = 'English'
): AsyncGenerator<StreamEvent, void, undefined> {
  // Enhanced prompt to handle reader URLs, pagination, and diagram requests.
  const prompt = `You are a sophisticated web reader and researcher. The user wants to read the *content* located at or represented by this URL: ${url}.
  
  CURRENT SECTION: ${sectionIndex + 1} (This implies we might be reading a book chapter by chapter).

  STRATEGY:
  1. **Identify the Work**: If the URL is a specific "reader" page (e.g., ManyBooks, Kindle Cloud) or a deep link, use the page title or metadata to identifying the Book Title and Author. If the URL itself is blocked/dynamic, FIND THE TEXT of this book from public open sources (Project Gutenberg, etc.) corresponding to Section/Chapter ${sectionIndex + 1}.
  2. **Extract Content**: Provide the **Full Text** of Chapter ${sectionIndex + 1} (or the next logical ~2000 word chunk if it's a single page). Do not summarize heavily; the user wants to READ.
  3. **Visuals**: If the text describes a specific scene, diagram, chart, or scientific concept that should be visualized, output a tag on a new line: \`[DIAGRAM: detailed prompt for the image]\`. Do this sparingly, only for key visual concepts.
  
  Language Requirement: Translate the content into ${language} if it is not already.

  OUTPUT FORMAT:
  - If Section 1: **Header** (Title & Author).
  - **The Content**: The actual text, formatted cleanly.
  - **Diagram Tags**: Embedded where appropriate.

  Do not output "I cannot access". Find the content.`;

  const config = { 
    tools: [{googleSearch: {}}],
  };

  try {
    const result = await ai.models.generateContentStream({
      model: searchModelName,
      contents: prompt,
      config: config,
    });

    for await (const chunk of result) {
      const text = chunk.text;
      const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      if (text || (sources && sources.length > 0)) {
        yield { type: 'chunk', text: text ?? '', sources: sources };
      }
    }
  } catch (error) {
    console.error('Error streaming web resource from Gemini:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    yield { type: 'error', message: `Could not retrieve content from the URL. ${errorMessage}`};
    throw new Error(errorMessage);
  }
}

/**
 * Generates a diagram or image based on a prompt found in the text.
 */
export async function generateInfoDiagram(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: imageModelName,
      contents: { parts: [{ text: `Create a clean, educational diagram or illustration for: ${prompt}` }] },
    });

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    throw new Error("No image data returned.");
  } catch (error) {
    console.error("Error generating diagram:", error);
    throw error;
  }
}