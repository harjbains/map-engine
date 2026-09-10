// Uber Engine shift-progress integration contract.
//
// Uber Engine is authoritative for earnings and shift calculations. Map Engine
// consumes ONLY the published keys and, for the "SYNC TODAY'S TOTAL" flow,
// writes a single documented request key that Uber Engine consumes on its side.
// Map Engine never inspects Uber Engine's internal storage structure. The full
// contract lives at docs/Uber-Shift-Progress-Integration.md.
//
// Both apps are deployed under the harjbains.github.io origin, so they share
// one browser localStorage namespace. Every read failure returns null so Map
// Engine simply draws a neutral track, shows "Shift data unavailable", and
// keeps rendering the map normally. Every write is best-effort and optional.

export const SHIFT_PROGRESS_KEYS = {
  progress: "uberEngine.shift.progress",
  active: "uberEngine.shift.active",
  updatedAt: "uberEngine.shift.updatedAt",
  state: "uberEngine.shift.state",
  syncRequest: "uberEngine.shift.syncRequest",
  controlRequest: "uberEngine.shift.controlRequest",
} as const;

export const SHIFT_PROGRESS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type ShiftProgressReadValue = (key: string) => string | null;

export type UberShiftState = {
  version: number;
  date: string;
  shiftActive: boolean;
  paused: boolean;
  hasActiveShift: boolean;
  dailyTarget: number;
  todayEarnings: number;
  dailyProgress: number;
  remaining: number;
  ridesRemaining: number;
  activeMinutes: number;
  hourlyRate: number;
  targetRate: number;
  weeklyTarget: number;
  weeklyEarnings: number;
  weeklyProgress: number;
  weeklyMinutes: number;
  weeklyRemaining: number;
  updatedAt: number;
};

export function parseProgressValue(value: string | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(1, Math.max(0, parsed));
}

function parseUpdatedAt(value: string | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) return asNumber;
  const asDate = Date.parse(trimmed);
  return Number.isFinite(asDate) ? asDate : null;
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseShiftProgress(
  readValue: ShiftProgressReadValue,
  now: number = Date.now(),
  maxAgeMs = SHIFT_PROGRESS_MAX_AGE_MS,
): number | null {
  const progress = parseProgressValue(readValue(SHIFT_PROGRESS_KEYS.progress));
  if (progress === null) return null;
  const active = readValue(SHIFT_PROGRESS_KEYS.active)?.trim().toLowerCase();
  if (active === "false") return null;
  const updatedAt = parseUpdatedAt(readValue(SHIFT_PROGRESS_KEYS.updatedAt));
  if (updatedAt !== null && now - updatedAt > maxAgeMs) return null;
  return progress;
}

export function parseShiftState(
  readValue: ShiftProgressReadValue,
  now: number = Date.now(),
  maxAgeMs = SHIFT_PROGRESS_MAX_AGE_MS,
): UberShiftState | null {
  const raw = readValue(SHIFT_PROGRESS_KEYS.state);
  if (!raw) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.version !== 1) return null;

  const updatedAt = finiteNumber(parsed.updatedAt, 0);
  if (updatedAt > 0 && now - updatedAt > maxAgeMs) return null;

  const dailyTarget = finiteNumber(parsed.dailyTarget, 0);
  const todayEarnings = finiteNumber(parsed.todayEarnings, 0);
  const weeklyTarget = finiteNumber(parsed.weeklyTarget, 0);
  const weeklyEarnings = finiteNumber(parsed.weeklyEarnings, 0);

  return {
    version: 1,
    date: String(parsed.date || ""),
    shiftActive: parsed.shiftActive === true,
    paused: parsed.paused === true,
    hasActiveShift: parsed.hasActiveShift === true,
    dailyTarget,
    todayEarnings,
    dailyProgress: Math.min(1, Math.max(0, finiteNumber(parsed.dailyProgress, dailyTarget > 0 ? todayEarnings / dailyTarget : 0))),
    remaining: Math.max(0, finiteNumber(parsed.remaining, Math.max(0, dailyTarget - todayEarnings))),
    ridesRemaining: Math.max(0, Math.round(finiteNumber(parsed.ridesRemaining, finiteNumber(parsed.targetUnitsRemaining, 0)))),
    activeMinutes: Math.max(0, Math.round(finiteNumber(parsed.activeMinutes, 0))),
    hourlyRate: finiteNumber(parsed.hourlyRate, 0),
    targetRate: finiteNumber(parsed.targetRate, 0),
    weeklyTarget,
    weeklyEarnings,
    weeklyProgress: Math.min(1, Math.max(0, finiteNumber(parsed.weeklyProgress, weeklyTarget > 0 ? weeklyEarnings / weeklyTarget : 0))),
    weeklyMinutes: Math.max(0, Math.round(finiteNumber(parsed.weeklyMinutes, 0))),
    weeklyRemaining: Math.max(0, finiteNumber(parsed.weeklyRemaining, Math.max(0, weeklyTarget - weeklyEarnings))),
    updatedAt,
  };
}

let cachedRawShiftState: string | null | undefined;
let cachedShiftState: UberShiftState | null = null;

// React's useSyncExternalStore requires a snapshot that is referentially stable
// between reads when the underlying value has not changed. parseShiftState builds
// a fresh object every call, so memoize on the raw stored JSON: the same raw
// string yields the same object identity, letting the modal's subscription
// settle without "Maximum update depth exceeded" loops in React 19.
export function parseShiftStateCached(
  readValue: ShiftProgressReadValue,
  now: number = Date.now(),
): UberShiftState | null {
  const raw = readValue(SHIFT_PROGRESS_KEYS.state);
  if (raw === cachedRawShiftState) return cachedShiftState;
  cachedRawShiftState = raw;
  cachedShiftState = parseShiftState(readValue, now);
  return cachedShiftState;
}

export function parseSyncRequest(
  readValue: ShiftProgressReadValue,
): { date: string; total: number; requestedAt: number } | null {
  const raw = readValue(SHIFT_PROGRESS_KEYS.syncRequest);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.total === "undefined" || parsed.total === null || parsed.total === "") return null;
    return {
      date: String(parsed.date || ""),
      total: Number(parsed.total),
      requestedAt: Number(parsed.requestedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function buildSyncRequest(date: string, total: number, now: number = Date.now()): string {
  return JSON.stringify({ date, total, requestedAt: now });
}

export function buildControlRequest(
  action: "start" | "pause" | "resume" | "end",
  options: { miles?: number } = {},
  now: number = Date.now(),
): string {
  const request: Record<string, unknown> = { action, requestedAt: now };
  if (options.miles !== undefined && options.miles !== null) {
    request.miles = Math.max(0, Number(options.miles) || 0);
  }
  return JSON.stringify(request);
}

export function parseControlRequest(
  readValue: ShiftProgressReadValue,
): { action: "start" | "pause" | "resume" | "end"; miles: number | null; requestedAt: number } | null {
  const raw = readValue(SHIFT_PROGRESS_KEYS.controlRequest);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const action = String(parsed?.action || "");
    if (action !== "start" && action !== "pause" && action !== "resume" && action !== "end") return null;
    const miles = parsed.miles;
    if (miles !== undefined && miles !== null && miles !== "" && !Number.isFinite(Number(miles))) return null;
    return {
      action,
      miles: miles === undefined || miles === null || miles === "" ? null : Number(miles),
      requestedAt: Number(parsed.requestedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}