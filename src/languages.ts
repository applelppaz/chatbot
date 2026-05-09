import type { Language } from "./types";

interface LanguageInfo {
  code: Language;
  label: string;
  shortLabel: string;
  flag: string;
  ttsLocale: string;
  inputPlaceholder: string;
}

export const LANGUAGES: Record<Language, LanguageInfo> = {
  english: {
    code: "english",
    label: "English",
    shortLabel: "EN",
    flag: "EN",
    ttsLocale: "en-US",
    inputPlaceholder: "e.g. apple",
  },
  chinese: {
    code: "chinese",
    label: "Chinese",
    shortLabel: "中",
    flag: "中",
    ttsLocale: "zh-CN",
    inputPlaceholder: "例: 苹果",
  },
  spanish: {
    code: "spanish",
    label: "Spanish",
    shortLabel: "ES",
    flag: "ES",
    ttsLocale: "es-ES",
    inputPlaceholder: "p. ej. manzana",
  },
  french: {
    code: "french",
    label: "French",
    shortLabel: "FR",
    flag: "FR",
    ttsLocale: "fr-FR",
    inputPlaceholder: "p. ex. pomme",
  },
};

export const LANGUAGE_ORDER: Language[] = [
  "english",
  "chinese",
  "spanish",
  "french",
];

export function isLanguage(value: unknown): value is Language {
  return (
    value === "english" ||
    value === "chinese" ||
    value === "spanish" ||
    value === "french"
  );
}
