import { useState } from "react";
import { LANGUAGES } from "../languages";
import { LanguagePicker } from "../components/LanguagePicker";
import { FormsView } from "../components/FormsView";
import { lookupForms } from "../api";
import { getSettings } from "../settings";
import type { FormsLookup, Language } from "../types";

export function LookupPage() {
  const [language, setLanguage] = useState<Language>(
    () => getSettings().lastUsedLanguage,
  );
  const [term, setTerm] = useState("");
  const [forms, setForms] = useState<FormsLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = term.trim();

  async function handleLookup() {
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setForms(null);
    try {
      const result = await lookupForms(trimmed, language);
      setForms(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Forms</h1>
        <p className="text-sm text-slate-500">
          Look up the conjugation or declension of any word — without saving it
          to your word bank.
        </p>
      </header>

      <section className="space-y-2">
        <label className="label">Language</label>
        <LanguagePicker value={language} onChange={setLanguage} />
      </section>

      <section className="space-y-2">
        <label className="label" htmlFor="lookup-term">
          Word or phrase
        </label>
        <input
          id="lookup-term"
          className="input"
          placeholder={LANGUAGES[language].inputPlaceholder}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLookup();
          }}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!trimmed || loading}
          onClick={handleLookup}
        >
          {loading ? "Looking up…" : "Look up"}
        </button>
        {error && <p className="text-sm text-rose-700">{error}</p>}
      </section>

      {forms && <FormsView forms={forms} language={language} />}
    </div>
  );
}
