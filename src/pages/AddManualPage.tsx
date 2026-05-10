import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LANGUAGES } from "../languages";
import { LanguagePicker } from "../components/LanguagePicker";
import { PlayButton } from "../components/PlayButton";
import { generateMetadata } from "../api";
import { putWord, termExists } from "../db";
import { newWordSRS } from "../srs";
import type { Language, VocabularyWord, WordMetadata } from "../types";

type SaveAs = "input" | "lemma";

export function AddManualPage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>("english");
  const [term, setTerm] = useState("");
  const [preview, setPreview] = useState<WordMetadata | null>(null);
  const [saveAs, setSaveAs] = useState<SaveAs>("lemma");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const termInputRef = useRef<HTMLInputElement>(null);

  // Land on the page with the keyboard already up so consecutive adds are
  // type-Generate-type without an extra tap.
  useEffect(() => {
    termInputRef.current?.focus();
  }, []);

  const trimmedTerm = term.trim();
  const lemmaSuggestion =
    preview?.lemma && preview.lemma.toLowerCase() !== trimmedTerm.toLowerCase()
      ? preview.lemma
      : null;
  const termToSave = lemmaSuggestion && saveAs === "lemma" ? lemmaSuggestion : trimmedTerm;

  async function handleGenerate() {
    if (!trimmedTerm) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setDuplicate(false);
    try {
      const exists = await termExists(trimmedTerm, language);
      if (exists) {
        setDuplicate(true);
        setLoading(false);
        return;
      }
      const meta = await generateMetadata(trimmedTerm, language);
      setPreview(meta);
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
      dateAdded: now,
      ...newWordSRS(now),
    };
    await putWord(word);
    navigate(`/words/${word.id}`, { replace: true });
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Add Word</h1>
        <Link to="/add/image" className="btn-ghost text-sm">
          From image →
        </Link>
      </header>

      <section className="space-y-2">
        <label className="label">Language</label>
        <LanguagePicker value={language} onChange={setLanguage} />
      </section>

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
          <button className="btn-primary w-full" onClick={handleSave}>
            Save to word bank
          </button>
        </section>
      )}
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
