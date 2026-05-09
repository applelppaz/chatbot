import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LANGUAGES } from "../languages";
import { LanguagePicker } from "../components/LanguagePicker";
import { extractWordsFromImage, generateMetadata } from "../api";
import { putWords, termExists } from "../db";
import { newWordSRS } from "../srs";
import type { Language, VocabularyWord } from "../types";

type Phase = "pick" | "extracting" | "review" | "importing" | "done";

export function AddImagePage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>("english");
  const [phase, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });

  async function handleFile(file: File) {
    setPhase("extracting");
    setError(null);
    try {
      const words = await extractWordsFromImage(file, language);
      const dedup: string[] = [];
      const seen = new Set<string>();
      for (const w of words) {
        const key = w.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          dedup.push(w);
        }
      }
      setExtracted(dedup);
      setSelected(new Set(dedup));
      setPhase(dedup.length ? "review" : "done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR failed.");
      setPhase("pick");
    }
  }

  function toggle(word: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }

  async function handleImport() {
    const words = extracted.filter((w) => selected.has(w));
    if (!words.length) return;
    setPhase("importing");
    setProgress({ done: 0, total: words.length, failed: 0 });

    const results: VocabularyWord[] = [];
    let failed = 0;

    // Run with a small concurrency cap.
    const CONCURRENCY = 4;
    let cursor = 0;
    async function worker() {
      while (cursor < words.length) {
        const idx = cursor++;
        const term = words[idx];
        try {
          if (await termExists(term, language)) {
            failed += 0; // not really a failure — skip silently
          } else {
            const meta = await generateMetadata(term, language);
            const now = Date.now();
            results.push({
              id: crypto.randomUUID(),
              term,
              language,
              pinyin: meta.pinyin,
              japaneseTranslation: meta.japaneseTranslation,
              exampleSentence: meta.exampleSentence,
              exampleSentenceJa: meta.exampleSentenceJa,
              dateAdded: now,
              ...newWordSRS(now),
            });
          }
        } catch {
          failed += 1;
        } finally {
          setProgress((p) => ({ ...p, done: p.done + 1, failed }));
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, words.length) }, worker),
    );

    if (results.length) await putWords(results);
    setPhase("done");
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">From Image</h1>
        <Link to="/add" className="btn-ghost text-sm">
          ← Manual
        </Link>
      </header>

      {phase !== "importing" && phase !== "done" && (
        <section className="space-y-2">
          <label className="label">Language</label>
          <LanguagePicker value={language} onChange={setLanguage} />
        </section>
      )}

      {phase === "pick" && (
        <section className="card space-y-3">
          <p className="text-sm text-slate-600">
            Take a photo or upload an image. Gemini will extract every{" "}
            {LANGUAGES[language].label} word it sees.
          </p>
          <label className="btn-primary w-full cursor-pointer">
            Choose image / take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </section>
      )}

      {phase === "extracting" && (
        <section className="card flex items-center justify-center py-12 text-slate-500">
          Extracting words…
        </section>
      )}

      {phase === "review" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {selected.size} of {extracted.length} selected
            </p>
            <div className="flex gap-2">
              <button
                className="btn-ghost text-sm"
                onClick={() => setSelected(new Set(extracted))}
              >
                All
              </button>
              <button
                className="btn-ghost text-sm"
                onClick={() => setSelected(new Set())}
              >
                None
              </button>
            </div>
          </div>
          <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {extracted.map((w) => (
              <li key={w}>
                <label className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-slate-900"
                    checked={selected.has(w)}
                    onChange={() => toggle(w)}
                  />
                  <span className="text-base">{w}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            className="btn-primary w-full"
            disabled={selected.size === 0}
            onClick={handleImport}
          >
            Import {selected.size} word{selected.size === 1 ? "" : "s"}
          </button>
        </section>
      )}

      {phase === "importing" && (
        <section className="card space-y-2">
          <p className="font-medium">
            Generating metadata… ({progress.done} / {progress.total})
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-slate-900 transition-all"
              style={{
                width: `${
                  progress.total
                    ? (progress.done / progress.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          {progress.failed > 0 && (
            <p className="text-sm text-rose-700">
              {progress.failed} failed (will be skipped).
            </p>
          )}
        </section>
      )}

      {phase === "done" && (
        <section className="card space-y-3">
          <p className="font-medium">
            Imported {progress.total - progress.failed} word
            {progress.total - progress.failed === 1 ? "" : "s"}.
          </p>
          {progress.failed > 0 && (
            <p className="text-sm text-rose-700">
              {progress.failed} failed.
            </p>
          )}
          <div className="flex gap-2">
            <button
              className="btn-secondary flex-1"
              onClick={() => {
                setPhase("pick");
                setExtracted([]);
                setSelected(new Set());
                setProgress({ done: 0, total: 0, failed: 0 });
              }}
            >
              Add another
            </button>
            <button
              className="btn-primary flex-1"
              onClick={() => navigate("/words")}
            >
              View words
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
