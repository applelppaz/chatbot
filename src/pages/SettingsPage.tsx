import { useEffect, useState } from "react";
import { LANGUAGES, LANGUAGE_ORDER } from "../languages";
import { listWords } from "../db";
import { isSpeechSupported, speak } from "../speech";
import { useSettings } from "../settings";
import { exportWordsToXlsx } from "../export";

export function SettingsPage() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [settings, updateSettings] = useSettings();

  useEffect(() => {
    listWords().then((all) => {
      const c: Record<string, number> = {};
      for (const w of all) {
        c[w.language] = (c[w.language] ?? 0) + 1;
      }
      setCounts(c);
      setTotal(all.length);
    });
  }, []);

  const speechOk = isSpeechSupported();

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const all = await listWords();
      if (all.length === 0) {
        setExportError("Word bank is empty — nothing to export.");
        return;
      }
      await exportWordsToXlsx(all);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="card space-y-3">
        <h2 className="font-medium">Word bank</h2>
        {!counts ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {LANGUAGE_ORDER.map((code) => (
              <li key={code} className="flex justify-between">
                <span>{LANGUAGES[code].label}</span>
                <span className="text-slate-500">{counts[code] ?? 0}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-slate-200 pt-1 font-medium">
              <span>Total</span>
              <span>
                {Object.values(counts).reduce((a, b) => a + b, 0)}
              </span>
            </li>
          </ul>
        )}
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={handleExport}
          disabled={exporting || total === 0}
        >
          {exporting
            ? "Preparing file…"
            : total === 0
              ? "Nothing to export yet"
              : `Export ${total} word${total === 1 ? "" : "s"} to Excel (.xlsx)`}
        </button>
        {exportError && (
          <p className="text-sm text-rose-700">{exportError}</p>
        )}
        <p className="text-xs text-slate-500">
          Downloads an .xlsx file with one row per word: Language, Term, Pinyin
          (for Chinese), Japanese, Example, Example (JA), Part of speech, Added.
          Opens in Excel, Numbers, Google Sheets, and LibreOffice.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Review</h2>
        <ToggleRow
          label="Auto-play term"
          description="Speak each card aloud as it appears in a review session."
          value={settings.autoPlayReview}
          onChange={(v) => updateSettings({ autoPlayReview: v })}
        />
        <ToggleRow
          label="Auto-flip after audio"
          description={
            settings.autoPlayReview
              ? "Reveal the meaning automatically once the term finishes playing."
              : "Requires Auto-play term to be on."
          }
          value={settings.autoFlipAfterSpeak}
          disabled={!settings.autoPlayReview}
          onChange={(v) => updateSettings({ autoFlipAfterSpeak: v })}
        />
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Pronunciation</h2>
        {speechOk ? (
          <>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Speech rate</span>
                <span className="text-slate-500">
                  {settings.speechRate.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.3}
                step={0.05}
                value={settings.speechRate}
                onChange={(e) =>
                  updateSettings({ speechRate: Number(e.target.value) })
                }
                className="w-full accent-slate-900"
              />
            </div>
            <p className="text-sm text-slate-600">
              Test the voice for each language.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGE_ORDER.map((code) => (
                <button
                  key={code}
                  className="btn-secondary"
                  onClick={() => speak(SAMPLE_PHRASES[code], code)}
                >
                  Test {LANGUAGES[code].label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-rose-700">
            Your browser does not support the Web Speech API.
          </p>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">About</h2>
        <p className="text-sm text-slate-600">
          Translations and example sentences are generated by Google Gemini via
          a Netlify Function. Your word bank is stored only in this browser
          (IndexedDB) and is not synced across devices.
        </p>
      </section>
    </div>
  );
}

const SAMPLE_PHRASES: Record<string, string> = {
  english: "Hello, this is a pronunciation test.",
  chinese: "你好，这是一个发音测试。",
  spanish: "Hola, esto es una prueba de pronunciación.",
  french: "Bonjour, ceci est un test de prononciation.",
};

function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={[
        "flex items-center justify-between gap-3",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={[
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition",
          value ? "bg-slate-900" : "bg-slate-300",
          disabled ? "cursor-not-allowed" : "",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
            value ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </label>
  );
}
