export type Language = "english" | "chinese" | "spanish" | "french";

export interface VocabularyWord {
  id: string;
  term: string;
  language: Language;
  pinyin: string | null;
  japaneseTranslation: string;
  exampleSentence: string;
  exampleSentenceJa: string;
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
}

export type ReviewGrade = "again" | "hard" | "good" | "easy";
