import { LANGUAGES, LANGUAGE_ORDER } from "../languages";
import type { Language } from "../types";

interface Props {
  value: Language;
  onChange: (lang: Language) => void;
}

export function LanguagePicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {LANGUAGE_ORDER.map((code) => {
        const info = LANGUAGES[code];
        const active = value === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            className={[
              "rounded-xl px-3 py-3 text-sm font-medium ring-1 transition",
              active
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
            ].join(" ")}
          >
            <div className="text-base">{info.shortLabel}</div>
            <div className="text-[11px] opacity-80">{info.label}</div>
          </button>
        );
      })}
    </div>
  );
}
