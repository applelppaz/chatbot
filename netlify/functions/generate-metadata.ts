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
  term?: string;
  language?: Language;
}

interface MetadataResult {
  japaneseTranslation: string;
  pinyin: string | null;
  exampleSentence: string;
  exampleSentenceJa: string;
  lemma: string | null;
  partOfSpeech: string | null;
  inflectionNote: string | null;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    japaneseTranslation: { type: "string" },
    pinyin: { type: "string", nullable: true },
    exampleSentence: { type: "string" },
    exampleSentenceJa: { type: "string" },
    lemma: { type: "string", nullable: true },
    partOfSpeech: { type: "string", nullable: true },
    inflectionNote: { type: "string", nullable: true },
  },
  required: [
    "japaneseTranslation",
    "exampleSentence",
    "exampleSentenceJa",
    "lemma",
    "partOfSpeech",
  ],
};

function buildPrompt(term: string, language: Language): string {
  const langName = LANGUAGE_NAMES[language];
  const pinyinClause =
    language === "chinese"
      ? `Always populate the "pinyin" field with the Hanyu Pinyin (with tone marks) of the term, using a single space between syllables.`
      : `The "pinyin" field must be null because the term is not Chinese.`;
  return [
    `You are a vocabulary tutor.`,
    `The user is studying ${langName} and their native language is Japanese.`,
    `Input ${langName} term (may contain a typo or be inflected/conjugated): "${term}"`,
    `Return STRICT JSON matching the schema, with:`,
    `- lemma: the dictionary citation form. For verbs: infinitive (or base form). For nouns: singular. For adjectives: masculine singular. If the input itself is already a citation form, lemma === input. If the input is a misspelling, lemma is the most plausible intended word. If you cannot map it to any real ${langName} word, set lemma to null.`,
    `- partOfSpeech: one short tag in English: "noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "phrase", "idiom", "other".`,
    `- inflectionNote: a SHORT English description of how the input differs from the lemma, e.g. "past tense of 'eat'", "plural of 'apple'", "feminine singular of 'beau'". null if input === lemma. null if lemma is null.`,
    `- japaneseTranslation: a natural, concise Japanese translation of the LEMMA (one or two senses joined by 「・」 if needed). If lemma is null, translate the input as best you can.`,
    `- exampleSentence: ONE natural ${langName} sentence (8–18 words) that uses the LEMMA (or the input if no lemma) in context.`,
    `- exampleSentenceJa: a natural Japanese translation of that example sentence (not a literal gloss).`,
    pinyinClause,
    `Do not add explanations or extra fields.`,
  ].join("\n");
}

function parseMetadata(raw: string, language: Language): MetadataResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(502, "Gemini did not return valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new HttpError(502, "Gemini response was not an object.");
  }
  const obj = parsed as Record<string, unknown>;
  const ja = obj.japaneseTranslation;
  const ex = obj.exampleSentence;
  const exJa = obj.exampleSentenceJa;
  const pinyinRaw = obj.pinyin;
  const lemmaRaw = obj.lemma;
  const posRaw = obj.partOfSpeech;
  const inflRaw = obj.inflectionNote;
  if (
    typeof ja !== "string" ||
    typeof ex !== "string" ||
    typeof exJa !== "string"
  ) {
    throw new HttpError(502, "Gemini response was missing required fields.");
  }
  const pinyin =
    language === "chinese" && typeof pinyinRaw === "string" && pinyinRaw.trim()
      ? pinyinRaw.trim()
      : null;
  const lemma =
    typeof lemmaRaw === "string" && lemmaRaw.trim() ? lemmaRaw.trim() : null;
  const partOfSpeech =
    typeof posRaw === "string" && posRaw.trim() ? posRaw.trim() : null;
  const inflectionNote =
    typeof inflRaw === "string" && inflRaw.trim() ? inflRaw.trim() : null;
  return {
    japaneseTranslation: ja.trim(),
    pinyin,
    exampleSentence: ex.trim(),
    exampleSentenceJa: exJa.trim(),
    lemma,
    partOfSpeech,
    inflectionNote,
  };
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }
  try {
    const body = (await req.json()) as RequestBody;
    const term = (body.term ?? "").trim();
    const language = body.language;
    if (!term) {
      throw new HttpError(400, "Missing 'term'.");
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
          parts: [{ text: buildPrompt(term, language) }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    };

    const raw = await callGemini(geminiBody);
    const result = parseMetadata(raw, language);
    return jsonResponse(200, result);
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: "/api/generate-metadata" };
