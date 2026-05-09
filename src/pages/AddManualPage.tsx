import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LANGUAGES } from "../languages";
import { LanguagePicker } from "../components/LanguagePicker";
import { PlayButton } from "../components/PlayButton";
import { generateMetadata } from "../api";
import { putWord, termExists } from "../db";
import { newWordSRS } from "../srs";
import type { Language, VocabularyWord, WordMetadata } from "../types";

export function AddManualPage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>("english");
  const [term, setTerm] = useState("");
  const [preview, setPreview] = useState<WordMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  const trimmedTerm = term.trim();

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
    const now = Date.now();
    const word: VocabularyWord = {
      id: crypto.randomUUID(),
      term: trimmedTerm,
      language,
      pinyin: preview.pinyin,
      japaneseTranslation: preview.japaneseTranslation,
      exampleSentence: preview.exampleSentence,
      exampleSentenceJa: preview.exampleSentenceJa,
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
          id="term"
          className="input"
          placeholder={LANGUAGES[language].inputPlaceholder}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
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
          <header className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold">{trimmedTerm}</div>
              {preview.pinyin && (
                <div className="text-sm text-slate-500">{preview.pinyin}</div>
              )}
            </div>
            <PlayButton text={trimmedTerm} language={language} />
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
