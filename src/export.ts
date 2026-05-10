import writeXlsxFile from "write-excel-file/browser";
import type { Column } from "write-excel-file/browser";
import { LANGUAGES, LANGUAGE_ORDER } from "./languages";
import type { Language, VocabularyWord } from "./types";

const HEADER_STYLE = {
  fontWeight: "bold" as const,
  backgroundColor: "#0f172a",
  color: "#ffffff",
  align: "left" as const,
};

const COLUMNS: Column<VocabularyWord>[] = [
  {
    header: { value: "Language", ...HEADER_STYLE },
    width: 12,
    cell: (w) => ({ value: LANGUAGES[w.language].label }),
  },
  {
    header: { value: "Term", ...HEADER_STYLE },
    width: 24,
    cell: (w) => ({ value: w.term, fontWeight: "bold" }),
  },
  {
    header: { value: "Pinyin", ...HEADER_STYLE },
    width: 18,
    cell: (w) => ({ value: w.pinyin ?? "" }),
  },
  {
    header: { value: "Japanese", ...HEADER_STYLE },
    width: 30,
    cell: (w) => ({ value: w.japaneseTranslation, wrap: true }),
  },
  {
    header: { value: "Example", ...HEADER_STYLE },
    width: 50,
    cell: (w) => ({ value: w.exampleSentence, wrap: true }),
  },
  {
    header: { value: "Example (JA)", ...HEADER_STYLE },
    width: 50,
    cell: (w) => ({ value: w.exampleSentenceJa, wrap: true }),
  },
  {
    header: { value: "Part of speech", ...HEADER_STYLE },
    width: 14,
    cell: (w) => ({ value: w.partOfSpeech ?? "" }),
  },
  {
    header: { value: "Note", ...HEADER_STYLE },
    width: 30,
    cell: (w) => ({ value: w.note ?? "", wrap: true }),
  },
  {
    header: { value: "Added", ...HEADER_STYLE },
    width: 12,
    cell: (w) => ({ value: new Date(w.dateAdded), format: "yyyy-mm-dd" }),
  },
];

function languageOrderIndex(l: Language): number {
  return LANGUAGE_ORDER.indexOf(l);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export async function exportWordsToXlsx(words: VocabularyWord[]): Promise<void> {
  // Sort by language (English, Chinese, Spanish, French) then by added date.
  const sorted = [...words].sort((a, b) => {
    const li = languageOrderIndex(a.language) - languageOrderIndex(b.language);
    if (li !== 0) return li;
    return a.dateAdded - b.dateAdded;
  });

  const fileName = `vocab-${formatDate(new Date())}.xlsx`;

  await writeXlsxFile(sorted, {
    columns: COLUMNS,
    sheet: "Vocabulary",
    stickyRowsCount: 1,
  }).toFile(fileName);
}
