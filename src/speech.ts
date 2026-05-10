import { LANGUAGES } from "./languages";
import { getSettings } from "./settings";
import type { Language } from "./types";

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    loadVoices();
  });
}

// Names of female voices known to ship with major OSes / browsers, by locale
// prefix. The exact catalogue depends on the device, so we score candidates
// rather than relying on a single voice being available.
const FEMALE_NAME_PATTERNS: Record<string, RegExp> = {
  en: /\b(samantha|allison|ava|susan|karen|victoria|zira|aria|jenny|sonia|eva|kate|catherine|fiona|moira|tessa|nicky|serena|joanna|salli|kimberly|ivy|emma|amy|libby|natasha|clara|female)\b/i,
  zh: /\b(tingting|ting-ting|tingting|sin-ji|mei-?jia|mei-?ling|huihui|hui-?hui|yaoyao|yao-?yao|xiaoxiao|xiao-?xiao|xiaoyi|yan|yunxi|yunyang|liang|female)\b/i,
  es: /\b(mónica|monica|paulina|marisol|soledad|helena|esperanza|lupe|paloma|penélope|penelope|rosa|sabina|isabela|carmen|female|mujer)\b/i,
  fr: /\b(amélie|amelie|audrey|aurélie|aurelie|hortense|marie|léa|lea|charlotte|brigitte|céline|celine|chloé|chloe|sylvie|virginie|julie|female|femme)\b/i,
};

const MALE_NAME_PATTERNS: Record<string, RegExp> = {
  en: /\b(daniel|alex|tom|tomm|aaron|fred|mark|roger|david|eric|ethan|james|mike|rishi|guy|oliver|ryan|brian|bruce|junior|reed|male)\b/i,
  zh: /\b(li-?mu|liang|kangkang|kang-?kang|yunjian|male)\b/i,
  es: /\b(jorge|diego|carlos|roberto|pablo|juan|miguel|luis|javier|enrique|raul|raúl|alvaro|álvaro|male|hombre)\b/i,
  fr: /\b(thomas|paul|pierre|henri|jean|marc|nicolas|grégory|gregory|antoine|claude|male|homme)\b/i,
};

function langPrefix(lang: string): string {
  return lang.split("-")[0].toLowerCase();
}

function scoreVoice(voice: SpeechSynthesisVoice, target: string): number {
  const targetLower = target.toLowerCase();
  const voiceLower = voice.lang.toLowerCase();
  let score = 0;
  if (voiceLower === targetLower) score += 100;
  else if (langPrefix(voiceLower) === langPrefix(targetLower)) score += 60;
  else return -Infinity;

  const prefix = langPrefix(targetLower);
  const female = FEMALE_NAME_PATTERNS[prefix];
  const male = MALE_NAME_PATTERNS[prefix];
  if (female && female.test(voice.name)) score += 50;
  if (male && male.test(voice.name)) score -= 100;

  // Prefer non-default voices on macOS/iOS where the default is sometimes male.
  // (No reliable signal — leave the default tiebreak to insertion order.)

  return score;
}

function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  const voices = cachedVoices.length ? cachedVoices : loadVoices();
  if (!voices.length) return undefined;
  let best: SpeechSynthesisVoice | undefined;
  let bestScore = -Infinity;
  for (const v of voices) {
    const s = scoreVoice(v, locale);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return bestScore > -Infinity ? best : undefined;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

interface SpeakOptions {
  onEnd?: () => void;
}

// Tracks the utterance currently submitted to the synth so a later speak() can
// invalidate the previous utterance's onEnd before calling synth.cancel()
// (which would otherwise fire the previous utterance's `end` event and trigger
// stale onEnd callbacks — e.g. premature card flips in Review).
let activeUtterance: SpeechSynthesisUtterance | null = null;

export function speak(
  text: string,
  language: Language,
  options: SpeakOptions = {},
): void {
  if (!isSpeechSupported()) {
    options.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  // Mark the previous utterance as superseded BEFORE we cancel — its onEnd
  // handler will see this and bail.
  activeUtterance = null;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANGUAGES[language].ttsLocale;
  const voice = pickVoice(utterance.lang);
  if (voice) utterance.voice = voice;
  utterance.rate = getSettings().speechRate;
  utterance.pitch = 1;

  if (options.onEnd) {
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      // Only fire if we're still the active utterance — i.e. we weren't
      // canceled by a subsequent speak() call.
      if (activeUtterance !== utterance) return;
      activeUtterance = null;
      options.onEnd?.();
    };
    // Single-assignment listeners so Safari's occasional "end + error" double
    // dispatch doesn't double-fire.
    utterance.onend = fire;
    utterance.onerror = fire;
  }

  activeUtterance = utterance;
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  activeUtterance = null;
  window.speechSynthesis.cancel();
}
