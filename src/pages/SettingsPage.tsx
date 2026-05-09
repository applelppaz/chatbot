import { useEffect, useState } from "react";
import { LANGUAGES, LANGUAGE_ORDER } from "../languages";
import { listWords, putWords, termExists } from "../db";
import { isSpeechSupported, speak } from "../speech";
import { useSettings } from "../settings";
import { exportWordsToXlsx } from "../export";
import { parseXlsxFile, type ImportResult, type ImportRow } from "../import";
import { newWordSRS } from "../srs";
import type { VocabularyWord } from "../types";

interface ImportPreview extends ImportResult {
  duplicates: ImportRow[];
  newRows: ImportRow[];
}

export function SettingsPage() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDone, setImportDone] = useState<{ inserted: number } | null>(null);
  const [settings, updateSettings] = useSettings();

  function refreshCounts() {
    return listWords().then((all) => {
      const c: Record<string, number> = {};
      for (const w of all) c[w.language] = (c[w.language] ?? 0) + 1;
      setCounts(c);
      setTotal(all.length);
    });
  }

  useEffect(() => {
    refreshCounts();
  }, []);

  const speechOk = isSpeechSupported();

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const all = await listWords();
      if (all.length === 0) {
        setExportError("Word bank is empty — nothing to export.");
        return;
      }
      await exportWordsToXlsx(all);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function handleFileChosen(file: File) {
    setImportError(null);
    setImportDone(null);
    setImportPreview(null);
    try {
      const result = await parseXlsxFile(file);
      // Partition valid rows into duplicates vs new (against the current bank).
      const duplicates: ImportRow[] = [];
      const newRows: ImportRow[] = [];
      for (const r of result.valid) {
        if (await termExists(r.term, r.language)) duplicates.push(r);
        else newRows.push(r);
      }
      setImportPreview({ ...result, duplicates, newRows });
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Could not read file.",
      );
    }
  }

  async function handleConfirmImport() {
    if (!importPreview) return;
    setImporting(true);
    setImportError(null);
    try {
      const now = Date.now();
      const words: VocabularyWord[] = importPreview.newRows.map((r, i) => ({
        id: crypto.randomUUID(),
        term: r.term,
        language: r.language,
        pinyin: r.pinyin,
        japaneseTranslation: r.japaneseTranslation,
        exampleSentence: r.exampleSentence,
        exampleSentenceJa: r.exampleSentenceJa,
        partOfSpeech: r.partOfSpeech,
        lemma: null,
        inflectionNote: null,
        // Stagger dateAdded by one ms so list order is preserved.
        dateAdded: now + i,
        ...newWordSRS(now + i),
      }));
      await putWords(words);
      setImportDone({ inserted: words.length });
      setImportPreview(null);
      await refreshCounts();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="card space-y-3">
        <h2 className="font-medium">Word bank</h2>
        {!counts ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {LANGUAGE_ORDER.map((code) => (
              <li key={code} className="flex justify-between">
                <span>{LANGUAGES[code].label}</span>
                <span className="text-slate-500">{counts[code] ?? 0}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-slate-200 pt-1 font-medium">
              <span>Total</span>
              <span>
                {Object.values(counts).reduce((a, b) => a + b, 0)}
              </span>
            </li>
          </ul>
        )}
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={handleExport}
          disabled={exporting || total === 0}
        >
          {exporting
            ? "Preparing file…"
            : total === 0
              ? "Nothing to export yet"
              : `Export ${total} word${total === 1 ? "" : "s"} to Excel (.xlsx)`}
        </button>
        {exportError && (
          <p className="text-sm text-rose-700">{exportError}</p>
        )}
        <p className="text-xs text-slate-500">
          Downloads an .xlsx file with one row per word: Language, Term, Pinyin
          (for Chinese), Japanese, Example, Example (JA), Part of speech, Added.
          Opens in Excel, Numbers, Google Sheets, and LibreOffice.
        </p>

        <div className="border-t border-slate-200 pt-3 space-y-2">
          <label className="btn-secondary w-full cursor-pointer">
            Import from Excel (.xlsx)
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileChosen(f);
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-slate-500">
            Reads any .xlsx with at least Language, Term, Japanese, and Example
            columns (header names are matched case-insensitively in English or
            Japanese — e.g. 言語 / 単語 / 意味 / 例文 also work).
          </p>
          {importError && (
            <p className="text-sm text-rose-700">{importError}</p>
          )}
          {importDone && (
            <p className="text-sm text-emerald-700">
              Imported {importDone.inserted} word
              {importDone.inserted === 1 ? "" : "s"}.
            </p>
          )}
        </div>

        {importPreview && (
          <div className="border-t border-slate-200 pt-3 space-y-3">
            <h3 className="font-medium">Preview</h3>
            <ul className="text-sm">
              <li className="flex justify-between py-1">
                <span>New</span>
                <span className="font-medium text-emerald-700">
                  {importPreview.newRows.length}
                </span>
              </li>
              <li className="flex justify-between py-1">
                <span>Duplicate (will be skipped)</span>
                <span className="text-slate-500">
                  {importPreview.duplicates.length}
                </span>
              </li>
              <li className="flex justify-between py-1">
                <span>Invalid (will be skipped)</span>
                <span
                  className={
                    importPreview.errors.length > 0
                      ? "text-rose-700"
                      : "text-slate-500"
                  }
                >
                  {importPreview.errors.length}
                </span>
              </li>
            </ul>

            {importPreview.errors.length > 0 && (
              <details className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800 ring-1 ring-rose-200">
                <summary className="cursor-pointer font-medium">
                  Show {importPreview.errors.length} error
                  {importPreview.errors.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-2 space-y-1">
                  {importPreview.errors.slice(0, 50).map((e) => (
                    <li key={`${e.row}-${e.message}`}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                  {importPreview.errors.length > 50 && (
                    <li>… and {importPreview.errors.length - 50} more</li>
                  )}
                </ul>
              </details>
            )}

            {importPreview.newRows.length > 0 && (
              <details className="rounded-lg bg-slate-50 p-2 text-xs text-slate-800 ring-1 ring-slate-200">
                <summary className="cursor-pointer font-medium">
                  Show first {Math.min(20, importPreview.newRows.length)} new
                  word{importPreview.newRows.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-2 space-y-1">
                  {importPreview.newRows.slice(0, 20).map((r) => (
                    <li
                      key={`${r.language}-${r.term}`}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <span className="font-medium">{r.term}</span>
                      <span className="text-slate-500">
                        {LANGUAGES[r.language].shortLabel} ·{" "}
                        {r.japaneseTranslation}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex gap-2">
              <button
                className="btn-secondary flex-1"
                disabled={importing}
                onClick={() => setImportPreview(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                disabled={importing || importPreview.newRows.length === 0}
                onClick={handleConfirmImport}
              >
                {importing
                  ? "Importing…"
                  : importPreview.newRows.length === 0
                    ? "Nothing new"
                    : `Import ${importPreview.newRows.length}`}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Review</h2>
        <ToggleRow
          label="Auto-play term"
          description="Speak each card aloud as it appears in a review session."
          value={settings.autoPlayReview}
          onChange={(v) => updateSettings({ autoPlayReview: v })}
        />
        <ToggleRow
          label="Auto-flip after audio"
          description={
            settings.autoPlayReview
              ? "Reveal the meaning automatically once the term finishes playing."
              : "Requires Auto-play term to be on."
          }
          value={settings.autoFlipAfterSpeak}
          disabled={!settings.autoPlayReview}
          onChange={(v) => updateSettings({ autoFlipAfterSpeak: v })}
        />
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Pronunciation</h2>
        {speechOk ? (
          <>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Speech rate</span>
                <span className="text-slate-500">
                  {settings.speechRate.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.3}
                step={0.05}
                value={settings.speechRate}
                onChange={(e) =>
                  updateSettings({ speechRate: Number(e.target.value) })
                }
                className="w-full accent-slate-900"
              />
            </div>
            <p className="text-sm text-slate-600">
              Test the voice for each language.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGE_ORDER.map((code) => (
                <button
                  key={code}
                  className="btn-secondary"
                  onClick={() => speak(SAMPLE_PHRASES[code], code)}
                >
                  Test {LANGUAGES[code].label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-rose-700">
            Your browser does not support the Web Speech API.
          </p>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">About</h2>
        <p className="text-sm text-slate-600">
          Translations and example sentences are generated by Google Gemini via
          a Netlify Function. Your word bank is stored only in this browser
          (IndexedDB) and is not synced across devices.
        </p>
      </section>
    </div>
  );
}

const SAMPLE_PHRASES: Record<string, string> = {
  english: "Hello, this is a pronunciation test.",
  chinese: "你好，这是一个发音测试。",
  spanish: "Hola, esto es una prueba de pronunciación.",
  french: "Bonjour, ceci est un test de prononciation.",
};

function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={[
        "flex items-center justify-between gap-3",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={[
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition",
          value ? "bg-slate-900" : "bg-slate-300",
          disabled ? "cursor-not-allowed" : "",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
            value ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </label>
  );
}
