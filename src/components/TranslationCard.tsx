import { useState } from "react";
import { LanguageBadge } from "./LanguageBadge";
import { PlayButton } from "./PlayButton";
import type { Language, WordMetadata } from "../types";

interface Props {
  language: Language;
  meta: WordMetadata;
  selected: boolean;
  saved: boolean;
  duplicate: boolean;
  onToggle: () => void;
  onSave: () => void | Promise<void>;
}

export function TranslationCard({
  language,
  meta,
  selected,
  saved,
  duplicate,
  onToggle,
  onSave,
}: Props) {
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
