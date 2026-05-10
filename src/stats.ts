// Tracks per-day review activity in localStorage so we can compute a streak
// without touching the IDB schema. Storage key holds an ascending list of
// review dates (YYYY-MM-DD), capped at 120 entries.

const STORAGE_KEY = "vocab-app-review-days";
const MAX_DAYS = 120;

function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readDays(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

function writeDays(days: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = days.length > MAX_DAYS ? days.slice(-MAX_DAYS) : days;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota errors
  }
}

export function recordReviewToday(now: Date = new Date()): void {
  const key = todayKey(now);
  const days = readDays();
  if (days[days.length - 1] === key) return; // already recorded today
  days.push(key);
  writeDays(days);
}

// Number of consecutive days, ending today (or yesterday if today not yet
// reviewed), with at least one review.
export function currentStreak(now: Date = new Date()): number {
  const days = readDays();
  if (!days.length) return 0;
  const set = new Set(days);
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  // Allow streak to include today OR start counting from yesterday if today
  // hasn't been reviewed yet — that way the streak doesn't drop to 0 just
  // because the user opens the app first thing in the morning.
  if (!set.has(todayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (set.has(todayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
