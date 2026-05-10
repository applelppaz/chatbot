import { useEffect, useState } from "react";
import { LANGUAGES } from "../languages";
import type { VocabularyWord } from "../types";

interface Props {
  word: VocabularyWord;
  onCancel: () => void;
  onSave: (updated: VocabularyWord) => void | Promise<void>;
}

export function EditWordSheet({ word, onCancel, onSave }: Props) {
  const [term, setTerm] = useState(word.term);
  const [pinyin, setPinyin] = useState(word.pinyin ?? "");
  const [ja, setJa] = useState(word.japaneseTranslation);
  const [example, setExample] = useState(word.exampleSentence);
  const [exampleJa, setExampleJa] = useState(word.exampleSentenceJa);
  const [pos, setPos] = useState(word.partOfSpeech ?? "");
  const [note, setNote] = useState(word.note ?? "");
  const [saving, setSaving] = useState(false);

  // Lock background scroll while the sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const trimmed = term.trim();
  const canSave = !!trimmed && !!ja.trim() && !!example.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    const updated: VocabularyWord = {
      ...word,
      term: trimmed,
      pinyin:
        word.language === "chinese" && pinyin.trim() ? pinyin.trim() : null,
      japaneseTranslation: ja.trim(),
      exampleSentence: example.trim(),
      exampleSentenceJa: exampleJa.trim(),
      partOfSpeech: pos.trim() || null,
      note: note.trim() || null,
    };
    try {
      await onSave(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit word</h2>
          <button
            type="button"
            className="text-sm text-slate-500"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Term">
            <input
              className="input"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </Field>

          {word.language === "chinese" && (
            <Field label="Pinyin">
              <input
                className="input"
                value={pinyin}
                onChange={(e) => setPinyin(e.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </Field>
          )}

          <Field label="Japanese">
            <input
              className="input"
              value={ja}
              onChange={(e) => setJa(e.target.value)}
            />
          </Field>

          <Field label={`Example (${LANGUAGES[word.language].label})`}>
            <textarea
              className="input min-h-[3.5rem]"
              value={example}
              onChange={(e) => setExample(e.target.value)}
            />
          </Field>

          <Field label="Example (JA)">
            <textarea
              className="input min-h-[3.5rem]"
              value={exampleJa}
              onChange={(e) => setExampleJa(e.target.value)}
            />
          </Field>

          <Field label="Part of speech">
            <input
              className="input"
              value={pos}
              onChange={(e) => setPos(e.target.value)}
              placeholder='e.g. "noun", "verb"'
            />
          </Field>

          <Field label="Note (mnemonic)">
            <textarea
              className="input min-h-[3.5rem]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='e.g. "sounds like…"'
            />
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-4 mt-4 flex gap-2 border-t border-slate-200 bg-white px-4 pt-3 pb-1">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={!canSave || saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
