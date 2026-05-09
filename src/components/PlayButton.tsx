import { speak, isSpeechSupported } from "../speech";
import type { Language } from "../types";

interface Props {
  text: string;
  language: Language;
  className?: string;
  label?: string;
}

export function PlayButton({ text, language, className, label }: Props) {
  const supported = isSpeechSupported();
  return (
    <button
      type="button"
      disabled={!supported}
      onClick={() => speak(text, language)}
      aria-label={label ?? `Pronounce ${text}`}
      className={
        className ??
        "inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white disabled:bg-slate-300"
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M3 10v4a1 1 0 0 0 1 1h3l4 4a1 1 0 0 0 1.7-.7V5.7A1 1 0 0 0 11 5L7 9H4a1 1 0 0 0-1 1z" />
        <path
          d="M16 8.5a4 4 0 0 1 0 7M19 5a8 8 0 0 1 0 14"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
