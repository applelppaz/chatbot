import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LANGUAGES, LANGUAGE_ORDER } from "../languages";
import { LanguagePicker } from "../components/LanguagePicker";
import { LanguageBadge } from "../components/LanguageBadge";
import { PlayButton } from "../components/PlayButton";
import { extractItemsFromImage, generateMetadata } from "../api";
import { putWord, putWords, termExists } from "../db";
import { newWordSRS } from "../srs";
import { useSettings } from "../settings";
import type {
  ExtractedItem,
  Language,
  MultiWordMetadata,
  VocabularyWord,
  WordMetadata,
} from "../types";

type Mode = "manual" | "image";

export function AddPage() {
  const [settings, updateSettings] = useSettings();
  const [mode, setMode] = useState<Mode>("manual");

  function setLanguage(next: Language) {
    updateSettings({ lastUsedLanguage: next });
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Add Word</h1>

      <div className="grid grid-cols-2 gap-2">
        <ModeButton
          active={mode === "manual"}
          label="Manual"
          onClick={() => setMode("manual")}
        />
        <ModeButton
          active={mode === "image"}
          label="From image"
          onClick={() => setMode("image")}
        />
      </div>

      <section className="space-y-2">
        <label className="label">Language</label>
        <LanguagePicker
          value={settings.lastUsedLanguage}
          onChange={setLanguage}
        />
      </section>

      {mode === "manual" ? (
        <ManualMode language={settings.lastUsedLanguage} />
      ) : (
        <ImageMode language={settings.lastUsedLanguage} />
      )}
    </div>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl px-4 py-3 text-sm font-medium ring-1 transition",
        active
          ? "bg-slate-900 text-white ring-slate-900"
          : "bg-white text-slate-700 ring-slate-200",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ───────────────────────────────────────────────────────── Manual mode ──

type SaveAs = "input" | "lemma";

function ManualMode({ language }: { language: Language }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [preview, setPreview] = useState<MultiWordMetadata | null>(null);
  const [saveAs, setSaveAs] = useState<SaveAs>("lemma");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  // Cross-language UI state
  const [selectedTranslations, setSelectedTranslations] = useState<
    Set<Language>
  >(new Set());
  const [savedTranslations, setSavedTranslations] = useState<Set<Language>>(
    new Set(),
  );
  const [existingTranslations, setExistingTranslations] = useState<
    Set<Language>
  >(new Set());
  const [savingBulk, setSavingBulk] = useState(false);
  const termInputRef = useRef<HTMLInputElement>(null);

  // Land on the page with the keyboard already up so consecutive adds are
  // type-Generate-type without an extra tap.
  useEffect(() => {
    termInputRef.current?.focus();
  }, []);

  // Reset per-preview state whenever the source language changes (a Generate
  // tied to the old language is no longer relevant).
  useEffect(() => {
    setPreview(null);
    setSelectedTranslations(new Set());
    setSavedTranslations(new Set());
    setExistingTranslations(new Set());
  }, [language]);

  const trimmedTerm = term.trim();
  const lemmaSuggestion =
    preview?.lemma && preview.lemma.toLowerCase() !== trimmedTerm.toLowerCase()
      ? preview.lemma
      : null;
  const termToSave =
    lemmaSuggestion && saveAs === "lemma" ? lemmaSuggestion : trimmedTerm;

  async function handleGenerate() {
    if (!trimmedTerm) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setDuplicate(false);
    setSelectedTranslations(new Set());
    setSavedTranslations(new Set());
    setExistingTranslations(new Set());
    try {
      const exists = await termExists(trimmedTerm, language);
      if (exists) {
        setDuplicate(true);
        setLoading(false);
        return;
      }
      const meta = await generateMetadata(trimmedTerm, language, {
        includeTranslations: true,
      });
      setPreview(meta);
      // Check duplicates in each target language up-front so cards can show
      // "Already in bank" and be excluded from Save all.
      const translations = meta.translations ?? {};
      const existing = new Set<Language>();
      const selectable = new Set<Language>();
      await Promise.all(
        (Object.entries(translations) as [Language, WordMetadata | undefined][]).map(
          async ([lang, m]) => {
            if (!m) return;
            const targetTerm = (m.lemma ?? "").trim();
            if (!targetTerm) return;
            if (await termExists(targetTerm, lang)) existing.add(lang);
            else selectable.add(lang);
          },
        ),
      );
      setExistingTranslations(existing);
      // Default-tick the non-duplicate translations so "Save all" is one tap.
      setSelectedTranslations(selectable);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach Gemini.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    const finalTerm = termToSave;
    if (await termExists(finalTerm, language)) {
      setDuplicate(true);
      return;
    }
    const now = Date.now();
    const trimmedNote = note.trim();
    const word: VocabularyWord = {
      id: crypto.randomUUID(),
      term: finalTerm,
      language,
      pinyin: preview.pinyin,
      japaneseTranslation: preview.japaneseTranslation,
      exampleSentence: preview.exampleSentence,
      exampleSentenceJa: preview.exampleSentenceJa,
      lemma: preview.lemma,
      partOfSpeech: preview.partOfSpeech,
      inflectionNote: saveAs === "lemma" ? null : preview.inflectionNote,
      note: trimmedNote || null,
      dateAdded: now,
      ...newWordSRS(now),
    };
    await putWord(word);
    navigate(`/words/${word.id}`, { replace: true });
  }

  function toggleTranslation(lang: Language) {
    setSelectedTranslations((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return next;
    });
  }

  async function saveTranslation(lang: Language, meta: WordMetadata) {
    const targetTerm = (meta.lemma ?? "").trim();
    if (!targetTerm) return;
    if (await termExists(targetTerm, lang)) {
      setExistingTranslations((prev) => new Set(prev).add(lang));
      return;
    }
    const now = Date.now();
    const word: VocabularyWord = {
      id: crypto.randomUUID(),
      term: targetTerm,
      language: lang,
      pinyin: meta.pinyin,
      japaneseTranslation: meta.japaneseTranslation,
      exampleSentence: meta.exampleSentence,
      exampleSentenceJa: meta.exampleSentenceJa,
      lemma: meta.lemma,
      partOfSpeech: meta.partOfSpeech,
      inflectionNote: null,
      note: null,
      dateAdded: now,
      ...newWordSRS(now),
    };
    await putWord(word);
    setSavedTranslations((prev) => new Set(prev).add(lang));
  }

  async function saveAllTranslations() {
    if (!preview?.translations) return;
    setSavingBulk(true);
    try {
      const targets = LANGUAGE_ORDER.filter(
        (l) =>
          l !== language &&
          selectedTranslations.has(l) &&
          !savedTranslations.has(l) &&
          !existingTranslations.has(l) &&
          !!preview.translations?.[l],
      );
      for (const lang of targets) {
        const meta = preview.translations[lang];
        if (meta) await saveTranslation(lang, meta);
      }
    } finally {
      setSavingBulk(false);
    }
  }

  const translationLanguages = preview?.translations
    ? LANGUAGE_ORDER.filter(
        (l) => l !== language && !!preview.translations?.[l],
      )
    : [];
  const pendingBulkCount = translationLanguages.filter(
    (l) =>
      selectedTranslations.has(l) &&
      !savedTranslations.has(l) &&
      !existingTranslations.has(l),
  ).length;

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <label className="label" htmlFor="term">
          Term
        </label>
        <input
          ref={termInputRef}
          id="term"
          className="input"
          placeholder={LANGUAGES[language].inputPlaceholder}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && trimmedTerm && !loading) handleGenerate();
          }}
          autoCapitalize="off"
          autoCorrect="off"
          autoFocus
        />
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!trimmedTerm || loading}
          onClick={handleGenerate}
        >
          {loading ? "Generating…" : "Generate"}
        </button>
        {duplicate && (
          <p className="text-sm text-amber-700">
            You already have this word in your {LANGUAGES[language].label} list.
          </p>
        )}
        {error && <p className="text-sm text-rose-700">{error}</p>}
      </section>

      {preview && (
        <section className="card space-y-3">
          {lemmaSuggestion && (
            <div className="space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <p className="text-sm text-amber-800">
                Looks like an inflected form. Save as:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <SaveAsButton
                  active={saveAs === "lemma"}
                  label={lemmaSuggestion}
                  sublabel="dictionary form"
                  onClick={() => setSaveAs("lemma")}
                />
                <SaveAsButton
                  active={saveAs === "input"}
                  label={trimmedTerm}
                  sublabel={preview.inflectionNote ?? "as typed"}
                  onClick={() => setSaveAs("input")}
                />
              </div>
            </div>
          )}
          <header className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="truncate text-2xl font-semibold">{termToSave}</div>
              {preview.pinyin && (
                <div className="text-sm text-slate-500">{preview.pinyin}</div>
              )}
              {preview.partOfSpeech && (
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                  {preview.partOfSpeech}
                </div>
              )}
            </div>
            <PlayButton text={termToSave} language={language} />
          </header>
          <Field label="Japanese" value={preview.japaneseTranslation} />
          <Field
            label="Example"
            value={preview.exampleSentence}
            playLanguage={language}
          />
          <Field label="Example (JA)" value={preview.exampleSentenceJa} />

          <div className="space-y-1">
            {!showNote ? (
              <button
                type="button"
                className="text-sm text-slate-500 underline"
                onClick={() => setShowNote(true)}
              >
                + Add personal note (mnemonic)
              </button>
            ) : (
              <>
                <label className="label" htmlFor="note">
                  Note (optional)
                </label>
                <textarea
                  id="note"
                  className="input min-h-[3.5rem]"
                  placeholder='e.g. "sounds like…", "from chapter 3"'
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </>
            )}
          </div>

          <button className="btn-primary w-full" onClick={handleSave}>
            Save to word bank
          </button>
        </section>
      )}

      {preview && translationLanguages.length > 0 && (
        <section className="space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Also save in other languages
            </h2>
            <button
              type="button"
              className="text-xs text-slate-500 underline disabled:no-underline disabled:opacity-50"
              disabled={savingBulk || pendingBulkCount === 0}
              onClick={saveAllTranslations}
            >
              {savingBulk
                ? "Saving…"
                : pendingBulkCount === 0
                  ? "Save all"
                  : `Save all (${pendingBulkCount})`}
            </button>
          </header>

          {translationLanguages.map((lang) => {
            const meta = preview.translations?.[lang];
            if (!meta) return null;
            return (
              <TranslationCard
                key={lang}
                language={lang}
                meta={meta}
                selected={selectedTranslations.has(lang)}
                saved={savedTranslations.has(lang)}
                duplicate={existingTranslations.has(lang)}
                onToggle={() => toggleTranslation(lang)}
                onSave={() => saveTranslation(lang, meta)}
              />
            );
          })}
        </section>
      )}
    </div>
  );
}

function TranslationCard({
  language,
  meta,
  selected,
  saved,
  duplicate,
  onToggle,
  onSave,
}: {
  language: Language;
  meta: WordMetadata;
  selected: boolean;
  saved: boolean;
  duplicate: boolean;
  onToggle: () => void;
  onSave: () => void | Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const targetTerm = (meta.lemma ?? "").trim() || "—";
  const disabled = saved || duplicate;

  async function handleClick() {
    if (disabled || saving) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={[
        "card space-y-2 transition",
        saved ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LanguageBadge language={language} />
            <span className="truncate text-xl font-semibold">{targetTerm}</span>
          </div>
          {meta.pinyin && (
            <div className="mt-1 text-sm text-slate-500">{meta.pinyin}</div>
          )}
          <div className="mt-1 text-base text-slate-800">
            {meta.japaneseTranslation}
          </div>
        </div>
        <PlayButton text={targetTerm} language={language} />
      </div>
      <div className="rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
        <div className="flex items-center justify-between gap-2">
          <span className="text-left">{meta.exampleSentence}</span>
          <PlayButton
            text={meta.exampleSentence}
            language={language}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700"
          />
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {meta.exampleSentenceJa}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 accent-slate-900"
            checked={selected}
            disabled={disabled}
            onChange={onToggle}
          />
          {duplicate
            ? "Already in bank"
            : saved
              ? "Saved ✓"
              : "Include in Save all"}
        </label>
        <button
          type="button"
          className="btn-secondary py-2 text-sm"
          disabled={disabled || saving}
          onClick={handleClick}
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

function SaveAsButton({
  active,
  label,
  sublabel,
  onClick,
}: {
  active: boolean;
  label: string;
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg px-3 py-2 text-left ring-1 transition",
        active
          ? "bg-amber-600 text-white ring-amber-600"
          : "bg-white text-amber-900 ring-amber-300 hover:bg-amber-100",
      ].join(" ")}
    >
      <div className="truncate font-medium">{label}</div>
      <div
        className={[
          "truncate text-xs",
          active ? "text-amber-100" : "text-amber-700",
        ].join(" ")}
      >
        {sublabel}
      </div>
    </button>
  );
}

function Field({
  label,
  value,
  playLanguage,
}: {
  label: string;
  value: string;
  playLanguage?: Language;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="label">{label}</div>
        {playLanguage && (
          <PlayButton
            text={value}
            language={playLanguage}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700"
          />
        )}
      </div>
      <div className="mt-1 text-base text-slate-900">{value}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────── Image mode ──

type Phase = "pick" | "extracting" | "review" | "importing" | "done";
type IncludeMode = "both" | "words" | "phrases";

function itemKey(item: ExtractedItem): string {
  return `${item.kind}::${item.text.toLowerCase()}`;
}

function ImageMode({ language }: { language: Language }) {
  const navigate = useNavigate();
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
      setSelected(new Set());
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
              partOfSpeech:
                meta.partOfSpeech ?? (item.kind === "phrase" ? "phrase" : null),
              inflectionNote: meta.inflectionNote,
              note: null,
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
      {phase !== "importing" && phase !== "done" && (
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
      )}

      {phase === "pick" && (
        <section className="space-y-3">
          <p className="text-sm text-slate-600">
            Take a photo or upload an image. Gemini reads the{" "}
            {LANGUAGES[language].label} text, joins words split across lines,
            and lists everything it found so you can pick what to keep.
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
        <section className="flex items-center justify-center py-12 text-slate-500">
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
                onClick={() =>
                  setSelected(new Set(extracted.map(itemKey)))
                }
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
        <section className="space-y-2">
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
        <section className="space-y-3">
          <p className="font-medium">
            Imported {progress.total - progress.failed} word
            {progress.total - progress.failed === 1 ? "" : "s"}.
          </p>
          {progress.failed > 0 && (
            <p className="text-sm text-rose-700">{progress.failed} failed.</p>
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
