import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteWord, getWord, putWord, termExists } from "../db";
import { LanguageBadge } from "../components/LanguageBadge";
import { PlayButton } from "../components/PlayButton";
import { FormsView } from "../components/FormsView";
import { EditWordSheet } from "../components/EditWordSheet";
import { TranslationCard } from "../components/TranslationCard";
import { generateMetadata, lookupForms } from "../api";
import { newWordSRS } from "../srs";
import { LANGUAGE_ORDER } from "../languages";
import type {
  FormsLookup,
  Language,
  MultiWordMetadata,
  VocabularyWord,
  WordMetadata,
} from "../types";

export function WordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [word, setWord] = useState<VocabularyWord | null | undefined>(undefined);
  const [forms, setForms] = useState<FormsLookup | null>(null);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [regenPreview, setRegenPreview] = useState<WordMetadata | null>(null);
  // Cross-language translate-and-add flow (mirrors AddPage ManualMode).
  const [xlateLoading, setXlateLoading] = useState(false);
  const [xlateError, setXlateError] = useState<string | null>(null);
  const [xlatePreview, setXlatePreview] = useState<MultiWordMetadata | null>(
    null,
  );
  const [xlateSelected, setXlateSelected] = useState<Set<Language>>(new Set());
  const [xlateSaved, setXlateSaved] = useState<Set<Language>>(new Set());
  const [xlateExisting, setXlateExisting] = useState<Set<Language>>(new Set());
  const [xlateBulkSaving, setXlateBulkSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getWord(id).then((w) => setWord(w ?? null));
  }, [id]);

  async function loadForms() {
    if (!word || forms || formsLoading) return;
    setFormsLoading(true);
    setFormsError(null);
    try {
      const queryTerm = word.lemma ?? word.term;
      const result = await lookupForms(queryTerm, word.language);
      setForms(result);
    } catch (err) {
      setFormsError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setFormsLoading(false);
    }
  }

  async function handleSaveEdit(updated: VocabularyWord) {
    await putWord(updated);
    setWord(updated);
    setEditing(false);
  }

  async function handleRegenerate() {
    if (!word || regenLoading) return;
    setRegenLoading(true);
    setRegenError(null);
    setRegenPreview(null);
    try {
      const meta = await generateMetadata(word.term, word.language);
      setRegenPreview(meta);
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Re-generate failed.");
    } finally {
      setRegenLoading(false);
    }
  }

  async function applyRegenerate() {
    if (!word || !regenPreview) return;
    const updated: VocabularyWord = {
      ...word,
      pinyin: regenPreview.pinyin,
      japaneseTranslation: regenPreview.japaneseTranslation,
      exampleSentence: regenPreview.exampleSentence,
      exampleSentenceJa: regenPreview.exampleSentenceJa,
      partOfSpeech: regenPreview.partOfSpeech ?? word.partOfSpeech ?? null,
      inflectionNote: regenPreview.inflectionNote ?? word.inflectionNote ?? null,
      lemma: regenPreview.lemma ?? word.lemma ?? null,
      // SRS state and note are intentionally preserved.
    };
    await putWord(updated);
    setWord(updated);
    setRegenPreview(null);
  }

  async function handleTranslateToOthers() {
    if (!word || xlateLoading) return;
    setXlateLoading(true);
    setXlateError(null);
    setXlatePreview(null);
    setXlateSelected(new Set());
    setXlateSaved(new Set());
    setXlateExisting(new Set());
    try {
      // Use the lemma if we have one, else the saved term — same shape Gemini
      // produced when the word was originally added.
      const sourceTerm = word.lemma ?? word.term;
      const meta = await generateMetadata(sourceTerm, word.language, {
        includeTranslations: true,
      });
      setXlatePreview(meta);
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
      setXlateExisting(existing);
      setXlateSelected(selectable);
    } catch (err) {
      setXlateError(
        err instanceof Error ? err.message : "Translate failed.",
      );
    } finally {
      setXlateLoading(false);
    }
  }

  function toggleXlate(lang: Language) {
    setXlateSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return next;
    });
  }

  async function saveXlate(lang: Language, meta: WordMetadata) {
    const targetTerm = (meta.lemma ?? "").trim();
    if (!targetTerm) return;
    if (await termExists(targetTerm, lang)) {
      setXlateExisting((prev) => new Set(prev).add(lang));
      return;
    }
    const now = Date.now();
    const w: VocabularyWord = {
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
    await putWord(w);
    setXlateSaved((prev) => new Set(prev).add(lang));
  }

  async function saveAllXlate() {
    if (!xlatePreview?.translations || !word) return;
    setXlateBulkSaving(true);
    try {
      const targets = LANGUAGE_ORDER.filter(
        (l) =>
          l !== word.language &&
          xlateSelected.has(l) &&
          !xlateSaved.has(l) &&
          !xlateExisting.has(l) &&
          !!xlatePreview.translations?.[l],
      );
      for (const lang of targets) {
        const meta = xlatePreview.translations[lang];
        if (meta) await saveXlate(lang, meta);
      }
    } finally {
      setXlateBulkSaving(false);
    }
  }

  if (word === undefined) {
    return <p className="py-12 text-center text-slate-400">Loading…</p>;
  }
  if (word === null) {
    return (
      <div className="card space-y-3 text-center">
        <p>Word not found.</p>
        <Link to="/words" className="btn-secondary">
          Back to words
        </Link>
      </div>
    );
  }

  async function handleDelete() {
    if (!word) return;
    if (!confirm(`Delete "${word.term}"?`)) return;
    await deleteWord(word.id);
    navigate("/words", { replace: true });
  }

  return (
    <div className="space-y-4">
      <Link to="/words" className="text-sm text-slate-500">
        ← Words
      </Link>

      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-3xl font-semibold">{word.term}</h1>
              <LanguageBadge language={word.language} />
            </div>
            {word.pinyin && (
              <div className="mt-1 text-base text-slate-500">{word.pinyin}</div>
            )}
            {(word.partOfSpeech || word.inflectionNote) && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {word.partOfSpeech && (
                  <span className="chip bg-slate-100 text-slate-700 uppercase tracking-wide">
                    {word.partOfSpeech}
                  </span>
                )}
                {word.inflectionNote && (
                  <span className="text-slate-500">{word.inflectionNote}</span>
                )}
              </div>
            )}
            {word.lemma && word.lemma.toLowerCase() !== word.term.toLowerCase() && (
              <div className="mt-1 text-xs text-slate-500">
                Lemma: <span className="font-medium">{word.lemma}</span>
              </div>
            )}
          </div>
          <PlayButton text={word.term} language={word.language} />
        </div>
        <div className="text-lg">{word.japaneseTranslation}</div>
      </section>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Example
          </h2>
          <PlayButton
            text={word.exampleSentence}
            language={word.language}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700"
          />
        </div>
        <p className="text-base">{word.exampleSentence}</p>
        <p className="text-sm text-slate-500">{word.exampleSentenceJa}</p>
      </section>

      {word.note && (
        <section className="card space-y-1">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Note
          </h2>
          <p className="whitespace-pre-wrap text-base">{word.note}</p>
        </section>
      )}

      <p className="px-1 text-xs text-slate-500">
        Next review {new Date(word.nextReviewAt).toLocaleDateString()}
        {" · "}Added {new Date(word.dateAdded).toLocaleDateString()}
        {" · "}Rep #{word.repetitions}
      </p>

      <section className="space-y-2">
        {!forms && !formsLoading && (
          <button className="btn-secondary w-full" onClick={loadForms}>
            Show forms / conjugations
          </button>
        )}
        {formsLoading && (
          <p className="text-center text-sm text-slate-500">Looking up forms…</p>
        )}
        {formsError && (
          <p className="text-sm text-rose-700">{formsError}</p>
        )}
        {forms && (
          <FormsView forms={forms} language={word.language} />
        )}
      </section>

      <section className="space-y-2">
        {!regenPreview && (
          <button
            className="btn-secondary w-full"
            onClick={handleRegenerate}
            disabled={regenLoading}
          >
            {regenLoading ? "Re-generating…" : "Re-generate translation & example"}
          </button>
        )}
        {regenError && <p className="text-sm text-rose-700">{regenError}</p>}
        {regenPreview && (
          <div className="card space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Replace with this?
            </h2>
            <Diff
              label="Japanese"
              before={word.japaneseTranslation}
              after={regenPreview.japaneseTranslation}
            />
            <Diff
              label="Example"
              before={word.exampleSentence}
              after={regenPreview.exampleSentence}
            />
            <Diff
              label="Example (JA)"
              before={word.exampleSentenceJa}
              after={regenPreview.exampleSentenceJa}
            />
            {word.language === "chinese" && (
              <Diff
                label="Pinyin"
                before={word.pinyin ?? ""}
                after={regenPreview.pinyin ?? ""}
              />
            )}
            <div className="flex gap-2">
              <button
                className="btn-secondary flex-1"
                onClick={() => setRegenPreview(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                onClick={applyRegenerate}
              >
                Replace
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        {!xlatePreview && (
          <button
            className="btn-secondary w-full"
            onClick={handleTranslateToOthers}
            disabled={xlateLoading}
          >
            {xlateLoading
              ? "Translating…"
              : "Add to other languages"}
          </button>
        )}
        {xlateError && <p className="text-sm text-rose-700">{xlateError}</p>}
        {xlatePreview && (() => {
          const otherLangs = LANGUAGE_ORDER.filter(
            (l) => l !== word.language && !!xlatePreview.translations?.[l],
          );
          const pendingBulk = otherLangs.filter(
            (l) =>
              xlateSelected.has(l) &&
              !xlateSaved.has(l) &&
              !xlateExisting.has(l),
          ).length;
          if (otherLangs.length === 0) {
            return (
              <p className="text-sm text-slate-500">
                No translations were returned.
              </p>
            );
          }
          return (
            <>
              <header className="flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
                  Translations
                </h2>
                <button
                  type="button"
                  className="text-xs text-slate-500 underline disabled:no-underline disabled:opacity-50"
                  disabled={xlateBulkSaving || pendingBulk === 0}
                  onClick={saveAllXlate}
                >
                  {xlateBulkSaving
                    ? "Saving…"
                    : pendingBulk === 0
                      ? "Save all"
                      : `Save all (${pendingBulk})`}
                </button>
              </header>
              {otherLangs.map((lang) => {
                const m = xlatePreview.translations?.[lang];
                if (!m) return null;
                return (
                  <TranslationCard
                    key={lang}
                    language={lang}
                    meta={m}
                    selected={xlateSelected.has(lang)}
                    saved={xlateSaved.has(lang)}
                    duplicate={xlateExisting.has(lang)}
                    onToggle={() => toggleXlate(lang)}
                    onSave={() => saveXlate(lang, m)}
                  />
                );
              })}
            </>
          );
        })()}
      </section>

      <div className="flex gap-2">
        <button className="btn-secondary flex-1" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className="btn-secondary flex-1 text-rose-600"
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>

      {editing && (
        <EditWordSheet
          word={word}
          onCancel={() => setEditing(false)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

function Diff({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  const changed = before.trim() !== after.trim();
  return (
    <div className="space-y-1">
      <div className="label">{label}</div>
      <div className="rounded-lg bg-slate-50 p-2 text-sm text-slate-500 line-through">
        {before || "—"}
      </div>
      <div
        className={[
          "rounded-lg p-2 text-sm",
          changed ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-500",
        ].join(" ")}
      >
        {after || "—"}
      </div>
    </div>
  );
}
