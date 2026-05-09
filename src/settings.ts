import { useEffect, useState } from "react";
import type { AppSettings } from "./types";

const STORAGE_KEY = "vocab-app-settings";

const DEFAULTS: AppSettings = {
  autoPlayReview: false,
  autoFlipAfterSpeak: false,
  speechRate: 0.9,
  geminiKeySlot: 1,
};

function read(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      autoPlayReview:
        typeof parsed.autoPlayReview === "boolean"
          ? parsed.autoPlayReview
          : DEFAULTS.autoPlayReview,
      autoFlipAfterSpeak:
        typeof parsed.autoFlipAfterSpeak === "boolean"
          ? parsed.autoFlipAfterSpeak
          : DEFAULTS.autoFlipAfterSpeak,
      speechRate:
        typeof parsed.speechRate === "number" &&
        parsed.speechRate >= 0.3 &&
        parsed.speechRate <= 1.5
          ? parsed.speechRate
          : DEFAULTS.speechRate,
      geminiKeySlot:
        parsed.geminiKeySlot === 1 ||
        parsed.geminiKeySlot === 2 ||
        parsed.geminiKeySlot === 3
          ? parsed.geminiKeySlot
          : DEFAULTS.geminiKeySlot,
    };
  } catch {
    return DEFAULTS;
  }
}

function write(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(
      new CustomEvent<AppSettings>("vocab-settings-changed", {
        detail: settings,
      }),
    );
  } catch {
    // ignore quota errors
  }
}

export function getSettings(): AppSettings {
  return read();
}

export function useSettings(): [AppSettings, (next: Partial<AppSettings>) => void] {
  const [settings, setSettings] = useState<AppSettings>(read);
  useEffect(() => {
    function onChange(e: Event) {
      const ce = e as CustomEvent<AppSettings>;
      if (ce.detail) setSettings(ce.detail);
    }
    window.addEventListener("vocab-settings-changed", onChange as EventListener);
    return () =>
      window.removeEventListener(
        "vocab-settings-changed",
        onChange as EventListener,
      );
  }, []);
  function update(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch };
    write(next);
    setSettings(next);
  }
  return [settings, update];
}
