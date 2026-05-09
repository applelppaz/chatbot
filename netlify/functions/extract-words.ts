import type { Context } from "@netlify/functions";
import {
  callGemini,
  errorResponse,
  HttpError,
  jsonResponse,
  type GeminiRequestBody,
} from "./_gemini.js";

type Language = "english" | "chinese" | "spanish" | "french";

const LANGUAGE_NAMES: Record<Language, string> = {
  english: "English",
  chinese: "Simplified Chinese",
  spanish: "Spanish",
  french: "French",
};

interface RequestBody {
  imageBase64?: string;
  mimeType?: string;
  language?: Language;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    words: { type: "array", items: { type: "string" } },
  },
  required: ["words"],
};

function buildPrompt(language: Language): string {
  const langName = LANGUAGE_NAMES[language];
  return [
    `You are an OCR + lemmatizer for vocabulary study.`,
    `Examine the image and extract every distinct ${langName} vocabulary word that is visible.`,
    `Rules:`,
    `- Return each word in its dictionary citation form (lemma): infinitive verbs, singular nouns, masculine/base adjective form.`,
    `- Lower-case English/Spanish/French words. Keep Chinese characters as-is.`,
    `- Skip proper nouns, numbers, punctuation, page numbers, and words from other languages.`,
    `- Deduplicate. Preserve reading order.`,
    `- Return strict JSON: { "words": ["...", "..."] }. No commentary.`,
  ].join("\n");
}

function parseWords(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(502, "Gemini did not return valid JSON.");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { words?: unknown }).words)
  ) {
    throw new HttpError(502, "Gemini response did not contain a 'words' array.");
  }
  const words = (parsed as { words: unknown[] }).words
    .filter((w): w is string => typeof w === "string")
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
  return Array.from(new Set(words));
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }
  try {
    const body = (await req.json()) as RequestBody;
    const { imageBase64, mimeType, language } = body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      throw new HttpError(400, "Missing 'imageBase64'.");
    }
    if (!mimeType || !/^image\/(jpeg|png|webp|heic)$/.test(mimeType)) {
      throw new HttpError(400, "Unsupported 'mimeType'.");
    }
    if (
      language !== "english" &&
      language !== "chinese" &&
      language !== "spanish" &&
      language !== "french"
    ) {
      throw new HttpError(400, "Invalid 'language'.");
    }

    const geminiBody: GeminiRequestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: buildPrompt(language) },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    };

    const raw = await callGemini(geminiBody);
    const words = parseWords(raw);
    return jsonResponse(200, { words });
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: "/api/extract-words" };
