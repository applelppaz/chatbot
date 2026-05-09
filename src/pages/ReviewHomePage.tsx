import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dueCount, listWords } from "../db";

export function ReviewHomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{
    due: number;
    total: number;
    nextDate: number | null;
  } | null>(null);

  useEffect(() => {
    Promise.all([dueCount(), listWords()]).then(([due, all]) => {
      const upcoming = all
        .filter((w) => w.nextReviewAt > Date.now())
        .sort((a, b) => a.nextReviewAt - b.nextReviewAt)[0];
      setStats({
        due,
        total: all.length,
        nextDate: upcoming?.nextReviewAt ?? null,
      });
    });
  }, []);

  if (!stats) {
    return <p className="py-12 text-center text-slate-400">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Review</h1>

      <section className="card space-y-2 text-center">
        <p className="text-sm uppercase tracking-wide text-slate-500">
          Due now
        </p>
        <p className="text-5xl font-semibold">{stats.due}</p>
        <p className="text-sm text-slate-500">
          {stats.total} total word{stats.total === 1 ? "" : "s"}
        </p>
      </section>

      <button
        className="btn-primary w-full"
        disabled={stats.due === 0}
        onClick={() => navigate("/review/session")}
      >
        {stats.due === 0 ? "Nothing due yet" : `Start session (${stats.due})`}
      </button>

      {stats.due === 0 && stats.nextDate && (
        <p className="text-center text-sm text-slate-500">
          Next card due{" "}
          {new Date(stats.nextDate).toLocaleString(undefined, {
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
