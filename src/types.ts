export type Language = "english" | "chinese" | "spanish" | "french";

export interface VocabularyWord {
  id: string;
  term: string;
  language: Language;
  pinyin: string | null;
  japaneseTranslation: string;
  exampleSentence: string;
  exampleSentenceJa: string;
  // Lexical info added in v2 (optional for legacy records).
  lemma?: string | null;
  partOfSpeech?: string | null;
  inflectionNote?: string | null;
  dateAdded: number;
  // SM-2 spaced repetition fields
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: number;
}

export interface WordMetadata {
  japaneseTranslation: string;
  pinyin: string | null;
  exampleSentence: string;
  exampleSentenceJa: string;
  lemma: string | null;
  partOfSpeech: string | null;
  inflectionNote: string | null;
}

export interface ExtractedItem {
  text: string;
  kind: "word" | "phrase";
}

export interface FormGroup {
  category: string;
  forms: { label: string; value: string }[];
}

export interface FormsLookup {
  lemma: string;
  partOfSpeech: string | null;
  pinyin: string | null;
  japaneseGloss: string;
  groups: FormGroup[];
}

export type ReviewGrade = "again" | "hard" | "good" | "easy";

export interface AppSettings {
  autoPlayReview: boolean;
  speechRate: number;
}

