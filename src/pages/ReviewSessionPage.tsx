import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dueWords, putWord } from "../db";
import { applyGrade } from "../srs";
import { speak } from "../speech";
import { LanguageBadge } from "../components/LanguageBadge";
import { PlayButton } from "../components/PlayButton";
import type { ReviewGrade, VocabularyWord } from "../types";

interface SessionStats {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export function ReviewSessionPage() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<VocabularyWord[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  useEffect(() => {
    dueWords().then((words) => {
      const shuffled = [...words].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
    });
  }, []);

  if (!queue) {
    return <p className="py-12 text-center text-slate-400">Loading…</p>;
  }

  if (queue.length === 0) {
    return (
      <div className="card space-y-3 text-center">
        <p>No cards due.</p>
        <button className="btn-primary" onClick={() => navigate("/review")}>
          Back
        </button>
      </div>
    );
  }

  if (index >= queue.length) {
    const total = stats.again + stats.hard + stats.good + stats.easy;
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Session complete</h1>
        <section className="card space-y-2">
          <p className="text-center text-3xl font-semibold">{total}</p>
          <p className="text-center text-sm text-slate-500">
            card{total === 1 ? "" : "s"} reviewed
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Stat label="Again" value={stats.again} color="text-rose-700" />
            <Stat label="Hard" value={stats.hard} color="text-amber-700" />
            <Stat label="Good" value={stats.good} color="text-emerald-700" />
            <Stat label="Easy" value={stats.easy} color="text-blue-700" />
          </ul>
        </section>
        <button
          className="btn-primary w-full"
          onClick={() => navigate("/review")}
        >
          Done
        </button>
      </div>
    );
  }

  const card = queue[index];

  async function handleGrade(grade: ReviewGrade) {
    const updated = applyGrade(card, grade);
    const next: VocabularyWord = { ...card, ...updated };
    await putWord(next);
    setStats((s) => ({ ...s, [grade]: s[grade] + 1 }));
    setIndex((i) => i + 1);
    setRevealed(false);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <button
          className="text-sm text-slate-500"
          onClick={() => navigate("/review")}
        >
          ← End
        </button>
        <span className="text-sm text-slate-500">
          {index + 1} / {queue.length}
        </span>
      </header>

      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-slate-900 transition-all"
          style={{ width: `${(index / queue.length) * 100}%` }}
        />
      </div>

      <section className="card flex min-h-[16rem] flex-col items-center justify-center gap-4 text-center">
        <LanguageBadge language={card.language} />
        <button
          type="button"
          className="text-4xl font-semibold tracking-tight"
          onClick={() => speak(card.term, card.language)}
          aria-label={`Pronounce ${card.term}`}
        >
          {card.term}
        </button>
        {revealed && card.pinyin && (
          <div className="text-base text-slate-500">{card.pinyin}</div>
        )}
        {revealed ? (
          <div className="space-y-2">
            <div className="text-xl">{card.japaneseTranslation}</div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="text-left">{card.exampleSentence}</span>
                <PlayButton
                  text={card.exampleSentence}
                  language={card.language}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700"
                />
              </div>
              <div className="mt-1 text-left text-xs text-slate-500">
                {card.exampleSentenceJa}
              </div>
            </div>
          </div>
        ) : (
          <button
            className="btn-secondary"
            onClick={() => setRevealed(true)}
          >
            Show answer
          </button>
        )}
      </section>

      {revealed && (
        <div className="grid grid-cols-4 gap-2">
          <GradeButton
            label="Again"
            color="bg-rose-600"
            onClick={() => handleGrade("again")}
          />
          <GradeButton
            label="Hard"
            color="bg-amber-500"
            onClick={() => handleGrade("hard")}
          />
          <GradeButton
            label="Good"
            color="bg-emerald-600"
            onClick={() => handleGrade("good")}
          />
          <GradeButton
            label="Easy"
            color="bg-blue-600"
            onClick={() => handleGrade("easy")}
          />
        </div>
      )}
    </div>
  );
}

function GradeButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn ${color} text-white active:opacity-90`}
    >
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className={color}>{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}
