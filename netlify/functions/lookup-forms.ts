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

interface RequestBody {
  term?: string;
  language?: Language;
  keySlot?: KeySlot;
}

interface FormGroupDTO {
  category: string;
  forms: { label: string; value: string }[];
}

interface FormsResult {
  lemma: string;
  partOfSpeech: string | null;
  pinyin: string | null;
  japaneseGloss: string;
  groups: FormGroupDTO[];
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    lemma: { type: "string" },
    partOfSpeech: { type: "string", nullable: true },
    pinyin: { type: "string", nullable: true },
    japaneseGloss: { type: "string" },
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          forms: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" },
              },
              required: ["label", "value"],
            },
          },
        },
        required: ["category", "forms"],
      },
    },
  },
  required: ["lemma", "japaneseGloss", "groups"],
};

function buildPrompt(term: string, language: Language): string {
  const langName = LANGUAGE_NAMES[language];
  const guidance = languageGuidance(language);
  return [
    `You are a ${langName} morphology lookup tool for Japanese learners.`,
    `Input ${langName} term (any form, possibly inflected or misspelled): "${term}"`,
    `Return STRICT JSON describing the lemma and its inflected forms.`,
    ``,
    `Required fields:`,
    `- lemma: dictionary citation form. If input is a misspelling, the most plausible correction.`,
    `- partOfSpeech: short English tag ("verb", "noun", "adjective", "adverb", "phrase", "idiom", "pronoun", "other").`,
    `- pinyin: ${language === "chinese" ? `Hanyu Pinyin (with tone marks) of the lemma.` : `null (not Chinese).`}`,
    `- japaneseGloss: short Japanese translation of the lemma.`,
    `- groups: an array of form-tables grouped by category. Each group has { category: string (English label), forms: [ { label: string, value: string } ] }.`,
    ``,
    `Group guidance for ${langName}:`,
    guidance,
    ``,
    `Rules:`,
    `- Provide the most useful 3–8 groups (do not exhaust every imaginable category).`,
    `- For verb conjugations, include subject pronoun together with the form (e.g. "yo hablo", "tu parles").`,
    `- For each form, "label" is a SHORT English description (e.g. "1st sg.", "past", "feminine plural"). "value" is the actual ${langName} text.`,
    `- If the term is a phrase or has no further forms, return an empty groups array but still fill the other fields.`,
    `- Do not add commentary outside the JSON.`,
  ].join("\n");
}

function languageGuidance(language: Language): string {
  switch (language) {
    case "english":
      return [
        `- Verbs: { "Conjugation": [ {label:"base", ...}, {label:"3rd sg.", ...}, {label:"past", ...}, {label:"past participle", ...}, {label:"present participle", ...} ] }`,
        `- Nouns: { "Number": [ {label:"singular"...}, {label:"plural"...} ] }`,
        `- Adjectives: { "Comparison": [ {label:"positive"...}, {label:"comparative"...}, {label:"superlative"...} ] }`,
        `- Optionally add { "Related forms": [...] } for noun↔verb↔adjective derivations.`,
      ].join("\n");
    case "spanish":
      return [
        `- Verbs: groups for "Indicative — Present", "Indicative — Preterite", "Indicative — Imperfect", "Indicative — Future", "Subjunctive — Present", "Imperative", "Non-finite". Each indicative/subjunctive group includes 6 forms (yo / tú / él/ella / nosotros / vosotros / ellos). Non-finite includes infinitive, gerundio, participio.`,
        `- Nouns: { "Forms": [singular, plural; masculine/feminine if applicable] }`,
        `- Adjectives: { "Forms": [masc. sg., fem. sg., masc. pl., fem. pl.] } and optional comparative/superlative.`,
      ].join("\n");
    case "french":
      return [
        `- Verbs: groups for "Indicatif — présent", "Indicatif — passé composé", "Indicatif — imparfait", "Indicatif — futur simple", "Subjonctif présent", "Conditionnel présent", "Impératif", "Formes non-finies". Each indicative/subjunctive group includes 6 forms (je / tu / il-elle / nous / vous / ils-elles).`,
        `- Nouns: { "Formes": [singulier, pluriel; masculin/féminin if applicable] }`,
        `- Adjectives: { "Accord": [m. sg., f. sg., m. pl., f. pl.] } and optional comparative/superlative.`,
      ].join("\n");
    case "chinese":
      return [
        `- Chinese has no inflection, so prefer:`,
        `- { "Related compounds": [ {label:"common compound", value:"..." } ... up to ~6 ] }`,
        `- { "Measure words": [ {label:"measure word", value:"..."} ] } for nouns`,
        `- { "Common collocations": [ {label:"collocation", value:"..."} ] }`,
        `- For verbs, add { "Aspect markers": [ {label:"perfective (了)", value:"..."}, {label:"continuous (着)", value:"..."} ] }`,
      ].join("\n");
  }
}

function parseForms(raw: string, language: Language): FormsResult {
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
  if (typeof obj.lemma !== "string" || typeof obj.japaneseGloss !== "string") {
    throw new HttpError(502, "Gemini response was missing required fields.");
  }
  const groupsRaw = Array.isArray(obj.groups) ? obj.groups : [];
  const groups: FormGroupDTO[] = [];
  for (const g of groupsRaw) {
    if (typeof g !== "object" || g === null) continue;
    const gr = g as { category?: unknown; forms?: unknown };
    if (typeof gr.category !== "string" || !Array.isArray(gr.forms)) continue;
    const forms: { label: string; value: string }[] = [];
    for (const f of gr.forms) {
      if (typeof f !== "object" || f === null) continue;
      const fr = f as { label?: unknown; value?: unknown };
      if (typeof fr.label !== "string" || typeof fr.value !== "string") continue;
      forms.push({ label: fr.label.trim(), value: fr.value.trim() });
    }
    if (forms.length) groups.push({ category: gr.category.trim(), forms });
  }
  const pinyin =
    language === "chinese" && typeof obj.pinyin === "string" && obj.pinyin.trim()
      ? obj.pinyin.trim()
      : null;
  const partOfSpeech =
    typeof obj.partOfSpeech === "string" && obj.partOfSpeech.trim()
      ? obj.partOfSpeech.trim()
      : null;
  return {
    lemma: obj.lemma.trim(),
    partOfSpeech,
    pinyin,
    japaneseGloss: obj.japaneseGloss.trim(),
    groups,
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
        { role: "user", parts: [{ text: buildPrompt(term, language) }] },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    };

    const slot = isKeySlot(body.keySlot) ? body.keySlot : 1;
    const raw = await callGemini(geminiBody, slot);
    return jsonResponse(200, parseForms(raw, language));
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: "/api/lookup-forms" };
