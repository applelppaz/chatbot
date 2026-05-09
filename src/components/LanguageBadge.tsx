import { LANGUAGES } from "../languages";
import type { Language } from "../types";

const COLORS: Record<Language, string> = {
  english: "bg-blue-100 text-blue-800",
  chinese: "bg-rose-100 text-rose-800",
  spanish: "bg-amber-100 text-amber-800",
  french: "bg-indigo-100 text-indigo-800",
};

export function LanguageBadge({ language }: { language: Language }) {
  const info = LANGUAGES[language];
  return (
    <span className={`chip ${COLORS[language]}`}>{info.shortLabel}</span>
  );
}
