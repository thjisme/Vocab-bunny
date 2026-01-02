import { GoogleGenAI, Type } from "@google/genai";



const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });



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



export async function processWords(input: string): Promise<any[]> {

try {

const response = await ai.models.generateContent({

model: "gemini-3-flash-preview",

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