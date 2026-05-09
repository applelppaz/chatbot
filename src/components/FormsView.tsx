import { PlayButton } from "./PlayButton";
import type { FormsLookup, Language } from "../types";

interface Props {
  forms: FormsLookup;
  language: Language;
}

export function FormsView({ forms, language }: Props) {
  return (
    <div className="space-y-3">
      <div className="card space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-xl font-semibold">{forms.lemma}</div>
            {forms.pinyin && (
              <div className="text-sm text-slate-500">{forms.pinyin}</div>
            )}
            {forms.partOfSpeech && (
              <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                {forms.partOfSpeech}
              </div>
            )}
          </div>
          <PlayButton text={forms.lemma} language={language} />
        </div>
        <div className="text-sm text-slate-700">{forms.japaneseGloss}</div>
      </div>

      {forms.groups.length === 0 && (
        <div className="card text-sm text-slate-500">
          No additional forms.
        </div>
      )}

      {forms.groups.map((group) => (
        <div key={group.category} className="card space-y-2">
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {group.category}
          </h3>
          <ul className="divide-y divide-slate-100">
            {group.forms.map((f, i) => (
              <li
                key={`${f.label}-${i}`}
                className="flex items-center gap-3 py-2"
              >
                <span className="w-32 shrink-0 text-xs text-slate-500">
                  {f.label}
                </span>
                <span className="flex-1 text-base">{f.value}</span>
                <PlayButton
                  text={f.value}
                  language={language}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
