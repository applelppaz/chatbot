import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteWord, getWord } from "../db";
import { LANGUAGES } from "../languages";
import { LanguageBadge } from "../components/LanguageBadge";
import { PlayButton } from "../components/PlayButton";
import type { VocabularyWord } from "../types";

export function WordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [word, setWord] = useState<VocabularyWord | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    getWord(id).then((w) => setWord(w ?? null));
  }, [id]);

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

      <section className="card space-y-1 text-sm text-slate-600">
        <div className="flex justify-between">
          <span>Language</span>
          <span>{LANGUAGES[word.language].label}</span>
        </div>
        <div className="flex justify-between">
          <span>Added</span>
          <span>{new Date(word.dateAdded).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Next review</span>
          <span>{new Date(word.nextReviewAt).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Reps</span>
          <span>
            {word.repetitions} (interval {word.intervalDays}d, EF{" "}
            {word.easinessFactor.toFixed(2)})
          </span>
        </div>
      </section>

      <button
        className="btn-secondary w-full text-rose-600"
        onClick={handleDelete}
      >
        Delete word
      </button>
    </div>
  );
}
