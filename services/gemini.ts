import { GoogleGenAI, Type } from "@google/genai";

// Ensure your API key is available here
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "YOUR_API_KEY_HERE" });

const WORD_PROCESSOR_PROMPT = `
You are a expert English-Vietnamese dictionary assistant for the VocabBunny app.
Analyze the provided word or list of words.
If the input is in Vietnamese, translate it to English first.
For each English word, provide:
1. Vietnamese translation (natural and common).
2. Part of Speech (Noun, Verb, Adjective, etc.).
3. Exactly TWO high-quality example sentences in English that clearly demonstrate how the word is used in context.
- Make the sentences helpful for language learners.
- Avoid overly complex jargon unless the word is technical.

Return the result as a JSON array of objects.
`;

// --- EXISTING WORD PROCESSING FUNCTION ---
export async function processWords(input: string): Promise<any[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", // Updated to a stable, capable model
      contents: input,
      config: {
        systemInstruction: WORD_PROCESSOR_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              english: { type: Type.STRING },
              vietnamese: { type: Type.STRING },
              pos: { type: Type.STRING },
              examples: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["english", "vietnamese", "pos", "examples"]
          }
        }
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini processing error:", error);
    return [];
  }
}

// --- NEW AUDIO GENERATION FUNCTION ---
export async function getGeminiAudio(word: string): Promise<string | null> {
  try {
    constZF = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", // REQUIRED: This model supports audio output
      contents: `Pronounce the English word clearly: ${word}`,
      config: {
        responseModalities: ["AUDIO"], // This tells Gemini to reply with Sound, not Text
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'
        }
      } as any // Cast to 'any' to bypass strict TS checks if SDK types are outdated
    });

    // The audio comes back as a base64 string inside 'inlineData'
    const part = response.candidates?.[0]?.content?.parts?.[0];
    
    if (part && part.inlineData && part.inlineData.data) {
      // Create a playable Data URI (e.g., "data:audio/wav;base64,.....")
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    
    return null;
  } catch (error) {
    console.warn("Gemini Audio Failed (Model might not support audio):", error);
    return null;
  }
}