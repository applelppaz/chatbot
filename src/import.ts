import { readSheet } from "read-excel-file/browser";
import { isLanguage, LANGUAGES, LANGUAGE_ORDER } from "./languages";
import type { Language } from "./types";

export interface ImportRow {
  language: Language;
  term: string;
  pinyin: string | null;
  japaneseTranslation: string;
  exampleSentence: string;
  exampleSentenceJa: string;
  partOfSpeech: string | null;
  note: string | null;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  valid: ImportRow[];
  errors: ImportRowError[];
}

type ColumnKey =
  | "language"
  | "term"
  | "pinyin"
  | "japaneseTranslation"
  | "exampleSentence"
  | "exampleSentenceJa"
  | "partOfSpeech"
  | "note"
  | "added";

// Header label aliases (case-insensitive, trimmed). Comprehensive enough to
// accept exports from this app, plus user-edited or hand-built spreadsheets in
// either English or Japanese.
const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  language: ["language", "lang", "言語", "言語名"],
  term: ["term", "word", "phrase", "単語", "語句", "見出し語"],
  pinyin: ["pinyin", "ピンイン", "拼音"],
  japaneseTranslation: [
    "japanese",
    "japanese translation",
    "translation",
    "meaning",
    "意味",
    "翻訳",
    "日本語訳",
    "日本語",
  ],
  exampleSentence: [
    "example",
    "example sentence",
    "sentence",
    "例文",
    "用例",
  ],
  exampleSentenceJa: [
    "example (ja)",
    "example ja",
    "example_ja",
    "example translation",
    "例文（日本語）",
    "例文(日本語)",
    "例文 (日本語)",
    "例文 ja",
    "例文の意味",
    "例文の翻訳",
  ],
  partOfSpeech: [
    "part of speech",
    "pos",
    "part-of-speech",
    "品詞",
  ],
  note: ["note", "notes", "memo", "メモ", "備考", "ノート"],
  added: ["added", "date added", "登録日", "追加日"],
};

function canonicalKeyForHeader(h: string): ColumnKey | null {
  const norm = h.trim().toLowerCase();
  if (!norm) return null;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [
    ColumnKey,
    string[],
  ][]) {
    if (aliases.includes(norm)) return key;
  }
  return null;
}

function parseLanguage(value: string): Language | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (isLanguage(v)) return v;
  for (const code of LANGUAGE_ORDER) {
    if (LANGUAGES[code].label.toLowerCase() === v) return code;
    if (LANGUAGES[code].shortLabel.toLowerCase() === v) return code;
  }
  const aliases: Record<string, Language> = {
    en: "english",
    "英語": "english",
    zh: "chinese",
    "中文": "chinese",
    "中国語": "chinese",
    "簡体字中国語": "chinese",
    "simplified chinese": "chinese",
    es: "spanish",
    "español": "spanish",
    espanol: "spanish",
    "スペイン語": "spanish",
    fr: "french",
    "français": "french",
    francais: "french",
    "フランス語": "french",
  };
  return aliases[v] ?? null;
}

export async function parseXlsxFile(file: File): Promise<ImportResult> {
  const sheet = await readSheet(file);
  if (!sheet || sheet.length === 0) {
    return { valid: [], errors: [{ row: 0, message: "File is empty." }] };
  }

  const headerRow = sheet[0];
  const columnMap = new Map<ColumnKey, number>();
  headerRow.forEach((cell, i) => {
    const key = canonicalKeyForHeader(String(cell ?? ""));
    if (key && !columnMap.has(key)) columnMap.set(key, i);
  });

  const required: ColumnKey[] = [
    "language",
    "term",
    "japaneseTranslation",
    "exampleSentence",
  ];
  const missing = required.filter((k) => !columnMap.has(k));
  if (missing.length) {
    return {
      valid: [],
      errors: [
        {
          row: 1,
          message: `Missing required column(s): ${missing.join(
            ", ",
          )}. Expected headers like Language, Term, Japanese, Example.`,
        },
      ],
    };
  }

  const valid: ImportRow[] = [];
  const errors: ImportRowError[] = [];

  function getCell(row: unknown[], key: ColumnKey): string {
    const idx = columnMap.get(key);
    if (idx === undefined) return "";
    const v = row[idx];
    if (v == null) return "";
    if (v instanceof Date) return v.toISOString();
    return String(v).trim();
  }

  for (let i = 1; i < sheet.length; i++) {
    const row = sheet[i];
    const rowNumber = i + 1; // 1-indexed for user-facing line numbers
    if (!row || row.every((c) => c == null || String(c).trim() === "")) {
      continue; // skip blank rows
    }

    const langStr = getCell(row, "language");
    const language = parseLanguage(langStr);
    if (!language) {
      errors.push({
        row: rowNumber,
        message: `Unknown language: "${langStr}".`,
      });
      continue;
    }

    const term = getCell(row, "term");
    if (!term) {
      errors.push({ row: rowNumber, message: "Term is required." });
      continue;
    }

    const japaneseTranslation = getCell(row, "japaneseTranslation");
    if (!japaneseTranslation) {
      errors.push({
        row: rowNumber,
        message: "Japanese translation is required.",
      });
      continue;
    }

    const exampleSentence = getCell(row, "exampleSentence");
    if (!exampleSentence) {
      errors.push({
        row: rowNumber,
        message: "Example sentence is required.",
      });
      continue;
    }

    const pinyinRaw = getCell(row, "pinyin");
    const partOfSpeechRaw = getCell(row, "partOfSpeech");
    const noteRaw = getCell(row, "note");

    valid.push({
      language,
      term,
      pinyin: language === "chinese" && pinyinRaw ? pinyinRaw : null,
      japaneseTranslation,
      exampleSentence,
      exampleSentenceJa: getCell(row, "exampleSentenceJa"),
      partOfSpeech: partOfSpeechRaw || null,
      note: noteRaw || null,
    });
  }

  return { valid, errors };
}
