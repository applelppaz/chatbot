import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LANGUAGES, LANGUAGE_ORDER } from "../languages";
import { listWords } from "../db";
import { fuzzyScore } from "../fuzzy";
import type { Language, VocabularyWord } from "../types";
import { LanguageBadge } from "../components/LanguageBadge";

type Filter = "all" | Language;
const FUZZY_THRESHOLD = 0.55;

export function WordsPage() {
  const navigate = useNavigate();
  const [words, setWords] = useState<VocabularyWord[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    listWords().then(setWords);
  }, []);

  const filtered = useMemo(() => {
    if (!words) return [];
    const q = query.trim();
    const inLanguage = (w: VocabularyWord) =>
      filter === "all" || w.language === filter;
    if (!q) return words.filter(inLanguage);
    // Fuzzy ranking across term, lemma, JP translation, pinyin.
    const scored = words
      .filter(inLanguage)
      .map((w) => ({
        word: w,
        score: fuzzyScore(q, [
          w.term,
          w.lemma ?? null,
          w.japaneseTranslation,
          w.pinyin ?? null,
        ]),
      }))
      .filter((r) => r.score >= FUZZY_THRESHOLD)
      .sort((a, b) => b.score - a.score);
    return scored.map((r) => r.word);
  }, [words, filter, query]);

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Words</h1>
        <div className="flex items-baseline gap-3">
          <Link to="/lookup" className="text-sm text-slate-500 underline">
            Forms ↗
          </Link>
          <span className="text-sm text-slate-500">
            {words ? `${filtered.length} / ${words.length}` : ""}
          </span>
        </div>
      </header>

      <input
        className="input"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex gap-2 overflow-x-auto">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
        />
        {LANGUAGE_ORDER.map((code) => (
          <FilterChip
            key={code}
            active={filter === code}
            onClick={() => setFilter(code)}
            label={LANGUAGES[code].shortLabel}
          />
        ))}
      </div>

      {!words ? (
        <p className="py-12 text-center text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={() => navigate("/add")} hasAny={words.length > 0} />
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          {filtered.map((w) => (
            <li key={w.id}>
              <Link
                to={`/words/${w.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 active:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-lg font-medium">
                      {w.term}
                    </span>
                    <LanguageBadge language={w.language} />
                  </div>
                  {w.pinyin && (
                    <div className="text-sm text-slate-500">{w.pinyin}</div>
                  )}
                  <div className="truncate text-sm text-slate-600">
                    {w.japaneseTranslation}
                  </div>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="h-5 w-5 shrink-0 text-slate-400"
                  aria-hidden
                >
                  <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "chip ring-1 transition",
        active
          ? "bg-slate-900 text-white ring-slate-900"
          : "bg-white text-slate-700 ring-slate-200",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function EmptyState({
  onAdd,
  hasAny,
}: {
  onAdd: () => void;
  hasAny: boolean;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-slate-500">
        {hasAny ? "No words match this filter." : "Your word bank is empty."}
      </p>
      {!hasAny && (
        <button onClick={onAdd} className="btn-primary">
          Add your first word
        </button>
      )}
    </div>
  );
}
