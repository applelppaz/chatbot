// Tiny Levenshtein-distance scorer used for typo-tolerant search across the
// word bank. Returns a normalized score in [0, 1] where 1 means a perfect
// substring match and 0 means completely unrelated.

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    // strip combining diacritics so "é" matches "e"
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// Score a single haystack string against a query. Substring match scores 1.0;
// prefix match scores 0.95; otherwise we use 1 - normalizedLevenshtein.
function scoreOne(query: string, haystack: string): number {
  const q = normalize(query);
  const h = normalize(haystack);
  if (!q || !h) return 0;
  if (h.includes(q)) {
    return h.startsWith(q) ? 0.95 + 0.05 * (q.length / h.length) : 0.85;
  }
  // Slide a window of length q across h (handles inflected/longer forms).
  let best = 0;
  const minLen = Math.max(q.length - 2, 1);
  const maxLen = q.length + 2;
  for (let len = minLen; len <= Math.min(maxLen, h.length); len++) {
    for (let start = 0; start + len <= h.length; start++) {
      const window = h.slice(start, start + len);
      const dist = levenshtein(q, window);
      const score = 1 - dist / Math.max(q.length, window.length);
      if (score > best) best = score;
    }
  }
  return best;
}

// Returns the best score across multiple fields (term, lemma, JP translation,
// pinyin). Threshold the result in the caller (0.6 is a sensible default).
export function fuzzyScore(query: string, fields: (string | null | undefined)[]): number {
  let best = 0;
  for (const f of fields) {
    if (!f) continue;
    const s = scoreOne(query, f);
    if (s > best) best = s;
  }
  return best;
}
