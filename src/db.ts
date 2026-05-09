import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { VocabularyWord } from "./types";

interface VocabDB extends DBSchema {
  words: {
    key: string;
    value: VocabularyWord;
    indexes: {
      byLanguage: string;
      byNextReviewAt: number;
      byDateAdded: number;
    };
  };
}

const DB_NAME = "vocab-app";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<VocabDB>> | null = null;

function getDB(): Promise<IDBPDatabase<VocabDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VocabDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("words", { keyPath: "id" });
        store.createIndex("byLanguage", "language");
        store.createIndex("byNextReviewAt", "nextReviewAt");
        store.createIndex("byDateAdded", "dateAdded");
      },
    });
  }
  return dbPromise;
}

export async function listWords(): Promise<VocabularyWord[]> {
  const db = await getDB();
  const all = await db.getAll("words");
  return all.sort((a, b) => b.dateAdded - a.dateAdded);
}

export async function getWord(id: string): Promise<VocabularyWord | undefined> {
  const db = await getDB();
  return db.get("words", id);
}

export async function putWord(word: VocabularyWord): Promise<void> {
  const db = await getDB();
  await db.put("words", word);
}

export async function putWords(words: VocabularyWord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("words", "readwrite");
  await Promise.all(words.map((w) => tx.store.put(w)));
  await tx.done;
}

export async function deleteWord(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("words", id);
}

export async function dueWords(
  language?: VocabularyWord["language"] | null,
  now: number = Date.now(),
): Promise<VocabularyWord[]> {
  const db = await getDB();
  const range = IDBKeyRange.upperBound(now);
  const due = await db.getAllFromIndex("words", "byNextReviewAt", range);
  const filtered = language ? due.filter((w) => w.language === language) : due;
  // Oldest-due first.
  return filtered.sort((a, b) => a.nextReviewAt - b.nextReviewAt);
}

export async function dueCountsByLanguage(
  now: number = Date.now(),
): Promise<{ all: number; byLanguage: Record<VocabularyWord["language"], number> }> {
  const db = await getDB();
  const range = IDBKeyRange.upperBound(now);
  const due = await db.getAllFromIndex("words", "byNextReviewAt", range);
  const byLanguage: Record<VocabularyWord["language"], number> = {
    english: 0,
    chinese: 0,
    spanish: 0,
    french: 0,
  };
  for (const w of due) byLanguage[w.language] += 1;
  return { all: due.length, byLanguage };
}

export async function termExists(
  term: string,
  language: VocabularyWord["language"],
): Promise<boolean> {
  const db = await getDB();
  const all = await db.getAllFromIndex("words", "byLanguage", language);
  const normalized = term.trim().toLowerCase();
  return all.some((w) => w.term.toLowerCase() === normalized);
}
