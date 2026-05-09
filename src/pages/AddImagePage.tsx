import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LANGUAGES } from "../languages";
import { LanguagePicker } from "../components/LanguagePicker";
import { extractItemsFromImage, generateMetadata } from "../api";
import { putWords, termExists } from "../db";
import { newWordSRS } from "../srs";
import type { ExtractedItem, Language, VocabularyWord } from "../types";

type Phase = "pick" | "extracting" | "review" | "importing" | "done";
type IncludeMode = "both" | "words" | "phrases";

function itemKey(item: ExtractedItem): string {
  return `${item.kind}::${item.text.toLowerCase()}`;
}

export function AddImagePage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>("english");
  const [includeMode, setIncludeMode] = useState<IncludeMode>("both");
  const [phase, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });

  async function handleFile(file: File) {
    setPhase("extracting");
    setError(null);
    try {
      const items = await extractItemsFromImage(file, language, includeMode);
      const dedup: ExtractedItem[] = [];
      const seen = new Set<string>();
      for (const it of items) {
        const k = itemKey(it);
        if (!seen.has(k)) {
          seen.add(k);
          dedup.push(it);
        }
      }
      setExtracted(dedup);
      setSelected(new Set(dedup.map(itemKey)));
      setPhase(dedup.length ? "review" : "done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR failed.");
      setPhase("pick");
    }
  }

  function toggle(item: ExtractedItem) {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = itemKey(item);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function handleImport() {
    const items = extracted.filter((it) => selected.has(itemKey(it)));
    if (!items.length) return;
    setPhase("importing");
    setProgress({ done: 0, total: items.length, failed: 0 });

    const results: VocabularyWord[] = [];
    let failed = 0;

    const CONCURRENCY = 4;
    let cursor = 0;
    async function worker() {
      while (cursor < items.length) {
        const idx = cursor++;
        const item = items[idx];
        try {
          if (await termExists(item.text, language)) {
            // already in bank — skip silently
          } else {
            const meta = await generateMetadata(item.text, language);
            const now = Date.now();
            results.push({
              id: crypto.randomUUID(),
              term: item.text,
              language,
              pinyin: meta.pinyin,
              japaneseTranslation: meta.japaneseTranslation,
              exampleSentence: meta.exampleSentence,
              exampleSentenceJa: meta.exampleSentenceJa,
              lemma: meta.lemma,
              partOfSpeech: meta.partOfSpeech ?? (item.kind === "phrase" ? "phrase" : null),
              inflectionNote: meta.inflectionNote,
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
      Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker),
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
        <>
          <section className="space-y-2">
            <label className="label">Language</label>
            <LanguagePicker value={language} onChange={setLanguage} />
          </section>
          <section className="space-y-2">
            <label className="label">Extract</label>
            <div className="grid grid-cols-3 gap-2">
              {(["both", "words", "phrases"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setIncludeMode(m)}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-medium ring-1 transition",
                    includeMode === m
                      ? "bg-slate-900 text-white ring-slate-900"
                      : "bg-white text-slate-700 ring-slate-200",
                  ].join(" ")}
                >
                  {m === "both"
                    ? "Words + phrases"
                    : m === "words"
                      ? "Words only"
                      : "Phrases only"}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {phase === "pick" && (
        <section className="card space-y-3">
          <p className="text-sm text-slate-600">
            Take a photo or upload an image. Gemini reads the {LANGUAGES[language].label} text, joins words split across lines, and lists everything it found so you can pick what to keep.
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
                onClick={() => setSelected(new Set(extracted.map(itemKey)))}
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
            {extracted.map((it) => {
              const k = itemKey(it);
              return (
                <li key={k}>
                  <label className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-slate-900"
                      checked={selected.has(k)}
                      onChange={() => toggle(it)}
                    />
                    <span className="flex-1 text-base">{it.text}</span>
                    <span
                      className={[
                        "chip text-xs",
                        it.kind === "phrase"
                          ? "bg-violet-100 text-violet-800"
                          : "bg-slate-100 text-slate-700",
                      ].join(" ")}
                    >
                      {it.kind}
                    </span>
                  </label>
                </li>
              );
            })}
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
