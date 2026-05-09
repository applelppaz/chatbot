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

const LANGUAGE_NAMES: Record<Language, string> = {
  english: "English",
  chinese: "Simplified Chinese",
  spanish: "Spanish",
  french: "French",
};

type IncludeMode = "words" | "phrases" | "both";

interface RequestBody {
  imageBase64?: string;
  mimeType?: string;
  language?: Language;
  include?: IncludeMode;
  keySlot?: KeySlot;
}

interface ExtractedItemDTO {
  text: string;
  kind: "word" | "phrase";
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          kind: { type: "string", enum: ["word", "phrase"] },
        },
        required: ["text", "kind"],
      },
    },
  },
  required: ["items"],
};

function buildPrompt(language: Language, include: IncludeMode): string {
  const langName = LANGUAGE_NAMES[language];
  const wantWords = include !== "phrases";
  const wantPhrases = include !== "words";
  const targets: string[] = [];
  if (wantWords) {
    targets.push(
      `single ${langName} VOCABULARY WORDS (single-word lemmas, dictionary citation form)`,
    );
  }
  if (wantPhrases) {
    targets.push(
      `notable multi-word PHRASES, set expressions, idioms, or fixed collocations (kept in their natural form, NOT lemmatized into individual pieces)`,
    );
  }
  return [
    `You are an OCR + lemmatizer for vocabulary study.`,
    `Examine the image and extract ${targets.join(" AND ")}.`,
    `Rules:`,
    `- Reading order: top-to-bottom, then left-to-right.`,
    `- LINE-WRAP HANDLING: when a word is split across two lines (often with a trailing hyphen, e.g. "appli-" then "cation"), join the two halves into one word ("application"). Do NOT include the broken halves.`,
    `- WORDS: return each in its dictionary citation form (lemma) — infinitive verbs, singular nouns, masculine/base adjective form. Set kind="word".`,
    `- PHRASES: return as they appear in the text (or lightly normalized for whitespace), preserving article and any obligatory function words. Set kind="phrase". A phrase is 2+ tokens. Examples: "make up one's mind", "à propos de", "ponerse las pilas", "马马虎虎".`,
    `- Lower-case English / Spanish / French. Keep Chinese characters as-is.`,
    `- Skip proper nouns, numbers, page numbers, punctuation-only tokens, and any text not in ${langName}.`,
    `- Deduplicate (case-insensitive). Preserve reading order.`,
    `- Return strict JSON: { "items": [ { "text": "...", "kind": "word" | "phrase" } ] }. No commentary.`,
  ].join("\n");
}

function parseItems(raw: string): ExtractedItemDTO[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(502, "Gemini did not return valid JSON.");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { items?: unknown }).items)
  ) {
    throw new HttpError(502, "Gemini response did not contain an 'items' array.");
  }
  const seen = new Set<string>();
  const out: ExtractedItemDTO[] = [];
  for (const raw of (parsed as { items: unknown[] }).items) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as { text?: unknown; kind?: unknown };
    if (typeof r.text !== "string") continue;
    const text = r.text.trim();
    if (!text) continue;
    const kind = r.kind === "phrase" ? "phrase" : "word";
    const key = `${kind}::${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text, kind });
  }
  return out;
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }
  try {
    const body = (await req.json()) as RequestBody;
    const { imageBase64, mimeType, language } = body;
    const include: IncludeMode =
      body.include === "words" || body.include === "phrases"
        ? body.include
        : "both";
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
            { text: buildPrompt(language, include) },
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

    const slot = isKeySlot(body.keySlot) ? body.keySlot : 1;
    const raw = await callGemini(geminiBody, slot);
    const items = parseItems(raw);
    return jsonResponse(200, { items });
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: "/api/extract-words" };
