import type { Context } from "@netlify/functions";
import {
  callGemini,
  errorResponse,
  HttpError,
  isKeySlot,
  jsonResponse,
  type GeminiRequestBody,
  type KeySlot,
} from "./_gemini.js";

type Language = "english" | "chinese" | "spanish" | "french";

const ALL_LANGUAGES: Language[] = ["english", "chinese", "spanish", "french"];

const LANGUAGE_NAMES: Record<Language, string> = {
  english: "English",
  chinese: "Simplified Chinese",
  spanish: "Spanish",
  french: "French",
};

interface RequestBody {
  term?: string;
  language?: Language;
  keySlot?: KeySlot;
  includeTranslations?: boolean;
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

interface MultiMetadataResult extends MetadataResult {
  translations?: Partial<Record<Language, MetadataResult>>;
}

const PRIMARY_PROPERTIES = {
  japaneseTranslation: { type: "string" },
  pinyin: { type: "string", nullable: true },
  exampleSentence: { type: "string" },
  exampleSentenceJa: { type: "string" },
  lemma: { type: "string", nullable: true },
  partOfSpeech: { type: "string", nullable: true },
  inflectionNote: { type: "string", nullable: true },
};

const PRIMARY_REQUIRED = [
  "japaneseTranslation",
  "exampleSentence",
  "exampleSentenceJa",
  "lemma",
  "partOfSpeech",
];

const RESPONSE_SCHEMA_BASIC = {
  type: "object",
  properties: PRIMARY_PROPERTIES,
  required: PRIMARY_REQUIRED,
};

function buildTranslationsSchema(sourceLanguage: Language) {
  const others = ALL_LANGUAGES.filter((l) => l !== sourceLanguage);
  const properties: Record<string, unknown> = {};
  for (const l of others) {
    properties[l] = {
      type: "object",
      nullable: true,
      properties: PRIMARY_PROPERTIES,
      required: PRIMARY_REQUIRED,
    };
  }
  return { type: "object", properties };
}

function buildMultiResponseSchema(sourceLanguage: Language) {
  return {
    type: "object",
    properties: {
      ...PRIMARY_PROPERTIES,
      translations: buildTranslationsSchema(sourceLanguage),
    },
    required: PRIMARY_REQUIRED,
  };
}

function buildPrompt(
  term: string,
  language: Language,
  includeTranslations: boolean,
): string {
  const langName = LANGUAGE_NAMES[language];
  const pinyinClause =
    language === "chinese"
      ? `Always populate the "pinyin" field with the Hanyu Pinyin (with tone marks) of the term, using a single space between syllables.`
      : `The "pinyin" field must be null because the term is not Chinese.`;

  const baseLines = [
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
  ];

  if (!includeTranslations) {
    return [...baseLines, `Do not add explanations or extra fields.`].join("\n");
  }

  const others = ALL_LANGUAGES.filter((l) => l !== language);
  const otherNames = others.map((l) => LANGUAGE_NAMES[l]);

  return [
    ...baseLines,
    ``,
    `ALSO produce a "translations" object whose keys are the OTHER three target languages: ${others.join(", ")}.`,
    `For each of ${otherNames.join(", ")}, populate one full metadata object with the SAME shape as the primary fields (lemma, partOfSpeech, inflectionNote, japaneseTranslation, exampleSentence, exampleSentenceJa, pinyin), translating the source concept into that language:`,
    `- lemma: the natural translation of the source LEMMA into that target language, in dictionary citation form. Use the form a learner would look up.`,
    `- partOfSpeech: same tag set as above; should normally match the source's POS unless the natural translation forces a category change.`,
    `- inflectionNote: null for translations (we did not type an inflected form in the target language).`,
    `- japaneseTranslation: a natural Japanese translation of the target-language lemma (often identical or near-identical to the source's japaneseTranslation, since it represents the same concept).`,
    `- exampleSentence: ONE natural sentence in that target language using the translated lemma (NOT a literal re-translation of the source's example; pick a sentence that flows naturally in the target language).`,
    `- exampleSentenceJa: a natural Japanese translation of that target-language example sentence.`,
    `- pinyin: Hanyu Pinyin with tone marks ONLY when the target language is Simplified Chinese; otherwise null.`,
    `If you cannot produce a sensible translation for one of the other languages, set that key to null and skip it.`,
    `Do not add explanations or extra fields.`,
  ].join("\n");
}

function parseMetadataObject(obj: unknown, language: Language): MetadataResult {
  if (typeof obj !== "object" || obj === null) {
    throw new HttpError(502, "Gemini response field was not an object.");
  }
  const o = obj as Record<string, unknown>;
  const ja = o.japaneseTranslation;
  const ex = o.exampleSentence;
  const exJa = o.exampleSentenceJa;
  const pinyinRaw = o.pinyin;
  const lemmaRaw = o.lemma;
  const posRaw = o.partOfSpeech;
  const inflRaw = o.inflectionNote;
  if (
    typeof ja !== "string" ||
    typeof ex !== "string" ||
    typeof exJa !== "string"
  ) {
    throw new HttpError(502, "Gemini response was missing required fields.");
  }
  if (!ja.trim() || !ex.trim() || !exJa.trim()) {
    throw new HttpError(
      502,
      "Gemini returned empty translation or example. Please try again.",
    );
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

function parseMetadata(
  raw: string,
  language: Language,
  includeTranslations: boolean,
): MultiMetadataResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(502, "Gemini did not return valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new HttpError(502, "Gemini response was not an object.");
  }
  const primary = parseMetadataObject(parsed, language);
  if (!includeTranslations) {
    return primary;
  }

  const translationsRaw = (parsed as Record<string, unknown>).translations;
  const translations: Partial<Record<Language, MetadataResult>> = {};
  if (translationsRaw && typeof translationsRaw === "object") {
    const t = translationsRaw as Record<string, unknown>;
    for (const l of ALL_LANGUAGES) {
      if (l === language) continue;
      const value = t[l];
      if (value == null) continue;
      try {
        translations[l] = parseMetadataObject(value, l);
      } catch {
        // Tolerate a single bad target — drop it rather than failing the whole
        // request. The primary metadata is still useful.
      }
    }
  }
  return { ...primary, translations };
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }
  try {
    const body = (await req.json()) as RequestBody;
    const term = (body.term ?? "").trim();
    const language = body.language;
    const includeTranslations = body.includeTranslations === true;
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
          parts: [{ text: buildPrompt(term, language, includeTranslations) }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: includeTranslations
          ? buildMultiResponseSchema(language)
          : RESPONSE_SCHEMA_BASIC,
      },
    };

    const slot = isKeySlot(body.keySlot) ? body.keySlot : 1;
    const raw = await callGemini(geminiBody, slot);
    const result = parseMetadata(raw, language, includeTranslations);
    return jsonResponse(200, result);
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: "/api/generate-metadata" };
