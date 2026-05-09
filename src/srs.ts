import type { ReviewGrade, VocabularyWord } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export const GRADE_QUALITY: Record<ReviewGrade, number> = {
  again: 2,
  hard: 3,
  good: 4,
  easy: 5,
};

export function newWordSRS(now: number = Date.now()): {
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: number;
} {
  return {
    easinessFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    nextReviewAt: now,
  };
}

// SM-2 algorithm (Piotr Wozniak). Returns updated SRS fields for the word.
export function applyGrade(
  word: VocabularyWord,
  grade: ReviewGrade,
  now: number = Date.now(),
): {
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: number;
} {
  const q = GRADE_QUALITY[grade];

  let { easinessFactor, intervalDays, repetitions } = word;

  // EF update (clamped to >= 1.3).
  easinessFactor = easinessFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easinessFactor < 1.3) easinessFactor = 1.3;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easinessFactor);
    }
  }

  return {
    easinessFactor,
    intervalDays,
    repetitions,
    nextReviewAt: now + intervalDays * DAY_MS,
  };
}
