// Tesla lean-dashboard data stores.
//
// The main Uber Engine publishes only aggregate earnings/hours. The Tesla modal
// additionally keeps two small best-effort journal stores so it can answer the
// four questions the driver actually needs while driving:
//   - recorded business mileage today and this week
//   - which day(s) this week produced which earnings (the week strip)
//
// Both live under the map-engine origin in localStorage next to the published
// shift state. All read paths tolerate missing/corrupt data and return empty
// values so the dashboard degrades gracefully. Everything here is additive:
// the authoritative numbers still come from Uber Engine's published state, and
// these stores only ever smooth over gaps and preserve the driver's entries.

export const BUSINESS_MILES_KEY = "map-engine-business-miles-v1";
export const SHIFT_DAYS_KEY = "map-engine-shift-days-v1";

export type BusinessMilesStore = Record<string, number>;
export type ShiftDayJournal = Record<string, { earnings: number; minutes: number }>;

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function nationalNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// --- Business mileage store ------------------------------------------------

export function parseBusinessMiles(raw: string | null): BusinessMilesStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const cleaned: BusinessMilesStore = {};
    for (const [date, miles] of Object.entries(parsed)) {
      if (isDateKey(date)) {
        const m = nationalNumber(miles);
        if (m > 0) cleaned[date] = m;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

// ISO date in the vehicle's local timezone.
export function isoOf(ms: number): string {
  const d = new Date(ms);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

// Monday 00:00 local time for the week containing `ms`.
export function mondayOf(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function weekMiles(store: BusinessMilesStore, nowMs: number = Date.now()): number {
  const start = mondayOf(nowMs);
  const end = start + 7 * 24 * 60 * 60 * 1000;
  let total = 0;
  for (const [date, miles] of Object.entries(store)) {
    const at = new Date(`${date}T00:00:00`).getTime();
    if (Number.isFinite(at) && at >= start && at < end) total += miles;
  }
  return total;
}

export function readBusinessMiles(): BusinessMilesStore {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return {};
  try {
    return parseBusinessMiles(window.localStorage.getItem(BUSINESS_MILES_KEY));
  } catch {
    return {};
  }
}

export function writeBusinessMiles(store: BusinessMilesStore): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  try {
    window.localStorage.setItem(BUSINESS_MILES_KEY, JSON.stringify(store));
  } catch {
    // Best effort: the state key is still authoritative for the current day.
  }
}

// Records today's miles and returns the merged store plus the recomputed week.
export function setTodaysMiles(miles: number, nowMs: number = Date.now()): { store: BusinessMilesStore; today: number; week: number } {
  const value = Math.max(0, miles);
  const store = readBusinessMiles();
  store[isoOf(nowMs)] = value;
  writeBusinessMiles(store);
  return { store, today: value, week: weekMiles(store, nowMs) };
}

// --- Shift day journal ------------------------------------------------------

export function parseShiftDays(raw: string | null): ShiftDayJournal {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const cleaned: ShiftDayJournal = {};
    for (const [date, entry] of Object.entries(parsed)) {
      if (!isDateKey(date) || !entry || typeof entry !== "object") continue;
      const asRecord = entry as Record<string, unknown>;
      const earnings = nationalNumber(asRecord.earnings);
      const minutes = Math.max(0, Math.round(Number(asRecord.minutes) || 0));
      if (earnings > 0) cleaned[date] = { earnings, minutes };
    }
    return cleaned;
  } catch {
    return {};
  }
}

export function readShiftDays(): ShiftDayJournal {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return {};
  try {
    return parseShiftDays(window.localStorage.getItem(SHIFT_DAYS_KEY));
  } catch {
    return {};
  }
}

export function writeShiftDays(journal: ShiftDayJournal): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  try {
    window.localStorage.setItem(SHIFT_DAYS_KEY, JSON.stringify(journal));
  } catch {
    // Best effort.
  }
}

export function rememberDay(date: string, earnings: number, minutes: number): ShiftDayJournal {
  const journal = readShiftDays();
  if (isDateKey(date) && earnings > 0) {
    journal[date] = { earnings, minutes: Math.max(0, Math.round(minutes)) };
    writeShiftDays(journal);
  }
  return journal;
}

export type WeekDayCell = { label: string; date: string; earnings: number; minutes: number };

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export function weekDays(journal: ShiftDayJournal, nowMs: number = Date.now()): WeekDayCell[] {
  const start = mondayOf(nowMs);
  return DAY_LABELS.map((label, index) => {
    const at = start + index * 24 * 60 * 60 * 1000;
    const date = isoOf(at);
    const entry = journal[date];
    return { label, date, earnings: entry?.earnings ?? 0, minutes: entry?.minutes ?? 0 };
  });
}