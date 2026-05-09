import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dueCountsByLanguage, listWords } from "../db";
import { LANGUAGES, LANGUAGE_ORDER } from "../languages";
import type { Language } from "../types";

type Filter = "all" | Language;

export function ReviewHomePage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [stats, setStats] = useState<{
    all: number;
    byLanguage: Record<Language, number>;
    total: number;
    nextDate: number | null;
    nextDateByLanguage: Partial<Record<Language, number>>;
  } | null>(null);

  useEffect(() => {
    Promise.all([dueCountsByLanguage(), listWords()]).then(([counts, all]) => {
      const upcoming = all
        .filter((w) => w.nextReviewAt > Date.now())
        .sort((a, b) => a.nextReviewAt - b.nextReviewAt);
      const nextDateByLanguage: Partial<Record<Language, number>> = {};
      for (const w of upcoming) {
        if (nextDateByLanguage[w.language] === undefined) {
          nextDateByLanguage[w.language] = w.nextReviewAt;
        }
      }
      setStats({
        all: counts.all,
        byLanguage: counts.byLanguage,
        total: all.length,
        nextDate: upcoming[0]?.nextReviewAt ?? null,
        nextDateByLanguage,
      });
    });
  }, []);

  if (!stats) {
    return <p className="py-12 text-center text-slate-400">Loading…</p>;
  }

  const dueForFilter =
    filter === "all" ? stats.all : stats.byLanguage[filter];
  const nextForFilter =
    filter === "all" ? stats.nextDate : stats.nextDateByLanguage[filter] ?? null;

  function startSession() {
    if (filter === "all") {
      navigate("/review/session");
    } else {
      navigate(`/review/session?lang=${filter}`);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Review</h1>

      <section className="space-y-2">
        <label className="label">Language</label>
        <div className="flex gap-2 overflow-x-auto">
          <FilterChip
            active={filter === "all"}
            label={`All (${stats.all})`}
            onClick={() => setFilter("all")}
          />
          {LANGUAGE_ORDER.map((code) => (
            <FilterChip
              key={code}
              active={filter === code}
              label={`${LANGUAGES[code].shortLabel} (${stats.byLanguage[code]})`}
              onClick={() => setFilter(code)}
            />
          ))}
        </div>
      </section>

      <section className="card space-y-2 text-center">
        <p className="text-sm uppercase tracking-wide text-slate-500">
          Due now
          {filter !== "all" ? ` — ${LANGUAGES[filter].label}` : ""}
        </p>
        <p className="text-5xl font-semibold">{dueForFilter}</p>
        <p className="text-sm text-slate-500">
          {stats.total} total word{stats.total === 1 ? "" : "s"}
        </p>
      </section>

      <button
        className="btn-primary w-full"
        disabled={dueForFilter === 0}
        onClick={startSession}
      >
        {dueForFilter === 0
          ? "Nothing due yet"
          : `Start session (${dueForFilter})`}
      </button>

      {dueForFilter === 0 && nextForFilter && (
        <p className="text-center text-sm text-slate-500">
          Next card due{" "}
          {new Date(nextForFilter).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}

      {stats.total === 0 && (
        <p className="text-center text-sm text-slate-500">
          Add some words first, then come back to study.
        </p>
      )}
    </div>
  );
}

function FilterChip({
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
        "chip ring-1 transition whitespace-nowrap",
        active
          ? "bg-slate-900 text-white ring-slate-900"
          : "bg-white text-slate-700 ring-slate-200",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
