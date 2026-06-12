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
              "rounded-2xl px-3 py-3 text-sm font-medium backdrop-blur-xl ring-1 transition",
              active
                ? "bg-slate-900 text-white ring-slate-900 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.6)]"
                : "bg-white/65 text-slate-700 ring-white/60 hover:bg-white/80",
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
