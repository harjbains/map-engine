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

import { isoOf, mondayOf } from "./business-miles.ts";

export const SHIFT_PROGRESS_KEYS = {
  progress: "uberEngine.shift.progress",
  active: "uberEngine.shift.active",
  updatedAt: "uberEngine.shift.updatedAt",
  state: "uberEngine.shift.state",
  syncRequest: "uberEngine.shift.syncRequest",
  controlRequest: "uberEngine.shift.controlRequest",
  mileageRequest: "uberEngine.shift.mileageRequest",
  mirror: "map-engine-shift-mirror-v1",
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
  businessMilesToday: number;
  businessMilesWeek: number;
  shiftStartedAt: number;
  ridesCompleted: number;
  updatedAt: number;
};

// Motivating cycle for the collapsed bar: 25 pounds of cumulative earnings laid
// out as five five-pound segments. Everything is derived from today's persisted
// running total (earnings % 25) so the visual bar can never drift from the
// authoritative earnings figure. Overflow carries into the next cycle and the
// daily/weekly totals above stay untouched.
export const SHIFT_CYCLE_POUNDS = 25;
export const SHIFT_SEGMENT_POUNDS = 5;
export const SHIFT_CYCLE_SEGMENTS = SHIFT_CYCLE_POUNDS / SHIFT_SEGMENT_POUNDS;

export type ShiftCycle = { cycle: number; cycled: number; completed: boolean };

export function shiftCycle(earnings: number): ShiftCycle {
  const e = Math.max(0, Math.round(earnings * 100) / 100);
  const cycled = e % SHIFT_CYCLE_POUNDS;
  return { cycle: Math.floor(e / SHIFT_CYCLE_POUNDS), cycled, completed: e > 0 && cycled === 0 };
}

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
  return parseShiftStateFromRaw(readValue(SHIFT_PROGRESS_KEYS.state), now, maxAgeMs);
}

function parseShiftStateFromRaw(
  raw: string | null,
  now: number,
  maxAgeMs = SHIFT_PROGRESS_MAX_AGE_MS,
): UberShiftState | null {
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
    businessMilesToday: Math.max(0, finiteNumber(parsed.businessMilesToday, 0)),
    businessMilesWeek: Math.max(0, finiteNumber(parsed.businessMilesWeek, 0)),
    shiftStartedAt: Math.round(finiteNumber(parsed.shiftStartedAt, 0)),
    ridesCompleted: Math.max(0, Math.round(finiteNumber(parsed.ridesCompleted, 0))),
    updatedAt,
  };
}

// A published state describes the day it was published for. If that date is not
// today, the shift figures belong to an earlier day: Map Engine rolls the view
// over so a fresh day opens at zero against the planned daily target - with the
// full ride count that target still needs - while keeping weekly figures
// accumulating within the same Mon-Sun week and resetting at the week boundary.
// The dashboard therefore answers "what is today's target and how many rides are
// required" even before Uber Engine republishes for the new day. The rolled-over
// view also carries today's date, so any optimistic writes (total sync, mileage,
// end-of-shift) target the current day rather than the stale one.
const RIDES_PER_REMAINDER = 5;

export function rolloverShiftState(state: UberShiftState, now: number = Date.now()): UberShiftState {
  const today = isoOf(now);
  if (state.date === today) return state;
  const stateMs = Date.parse(`${state.date}T00:00:00`);
  const sameWeek = Number.isFinite(stateMs) ? mondayOf(stateMs) === mondayOf(now) : false;
  const dailyTarget = Math.max(0, state.dailyTarget);
  const weeklyTarget = Math.max(0, state.weeklyTarget);
  return {
    ...state,
    date: today,
    shiftActive: false,
    paused: false,
    hasActiveShift: false,
    todayEarnings: 0,
    dailyProgress: 0,
    remaining: dailyTarget,
    ridesRemaining: Math.round(dailyTarget / RIDES_PER_REMAINDER),
    activeMinutes: 0,
    hourlyRate: 0,
    weeklyEarnings: sameWeek ? state.weeklyEarnings : 0,
    weeklyProgress: sameWeek ? state.weeklyProgress : 0,
    weeklyMinutes: sameWeek ? state.weeklyMinutes : 0,
    weeklyRemaining: sameWeek ? state.weeklyRemaining : weeklyTarget,
    businessMilesToday: 0,
    businessMilesWeek: sameWeek ? state.businessMilesWeek : 0,
    shiftStartedAt: 0,
    ridesCompleted: 0,
  };
}

// React's useSyncExternalStore requires a snapshot that is referentially stable
// between reads when the underlying value has not changed. parseShiftState builds
// a fresh object every call, so memoize on the resolved raw JSON plus the local
// day: the same raw string on the same day yields the same object identity,
// letting the modal's subscription settle without "Maximum update depth
// exceeded" loops in React 19. Rollover keeps daily-bound figures pinned to the
// current day so a stale publish never leaks yesterday's numbers onto the map.
let cachedRawShiftState: string | null | undefined;
let cachedShiftState: UberShiftState | null = null;
let cachedShiftDayKey = "";

export function parseShiftStateCached(
  readValue: ShiftProgressReadValue,
  now: number = Date.now(),
): UberShiftState | null {
  return parseShiftStateCachedResolved(readValue(SHIFT_PROGRESS_KEYS.state), now);
}

function parseShiftStateCachedResolved(raw: string | null, now: number): UberShiftState | null {
  const dayKey = isoOf(now);
  if (raw === cachedRawShiftState && dayKey === cachedShiftDayKey) return cachedShiftState;
  cachedRawShiftState = raw;
  cachedShiftDayKey = dayKey;
  const parsed = raw === null ? null : parseShiftStateFromRaw(raw, now);
  cachedShiftState = parsed === null ? null : rolloverShiftState(parsed, now);
  return cachedShiftState;
}

// Map Engine keeps its own best-effort mirror of the latest validated shift
// publish under its own key. Uber Engine stays authoritative: the mirror is only
// ever consulted when today's published state is missing, so a mid-day loss of
// that single key (browser eviction, an engine restart that rewrites shared
// storage, a tab closed before a flush) does not reset an active day's data.
// The snapshot reads the mirror BEFORE defaults come into play, and re-mirrors
// every validated read so the copy stays current.
let lastMirrorWritten: string | null = null;

export function resolveShiftRaw(
  engineRaw: string | null,
  readValue: ShiftProgressReadValue,
  now: number = Date.now(),
): string | null {
  if (typeof engineRaw === "string" && engineRaw.trim() !== "") return engineRaw;
  const mirrorRaw = readValue(SHIFT_PROGRESS_KEYS.mirror);
  if (typeof mirrorRaw !== "string" || mirrorRaw.trim() === "") return null;
  try {
    const mirror = JSON.parse(mirrorRaw) as Record<string, unknown>;
    if (mirror && typeof mirror === "object" && String(mirror.date) === isoOf(now)) return mirrorRaw;
  } catch {
    // A corrupt mirror is never trusted over an absent published state.
  }
  return null;
}

export function writeShiftMirror(setValue: (key: string, value: string) => void, raw: string): void {
  if (raw === lastMirrorWritten) return;
  lastMirrorWritten = raw;
  try {
    setValue(SHIFT_PROGRESS_KEYS.mirror, raw);
  } catch {
    // Best effort: the shared published key is still authoritative.
  }
}

export function snapshotShiftState(
  readValue: ShiftProgressReadValue,
  setValue: (key: string, value: string) => void,
  now: number = Date.now(),
): UberShiftState | null {
  const engineRaw = readValue(SHIFT_PROGRESS_KEYS.state);
  const raw = resolveShiftRaw(engineRaw, readValue, now);
  if (raw !== null) writeShiftMirror(setValue, raw);
  return parseShiftStateCachedResolved(raw, now);
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

export function buildMileageRequest(
  date: string,
  miles: number,
  now: number = Date.now(),
): string {
  const request: Record<string, unknown> = { date, miles: Math.max(0, Number(miles) || 0), requestedAt: now };
  return JSON.stringify(request);
}

export function parseMileageRequest(
  readValue: ShiftProgressReadValue,
): { date: string; miles: number; requestedAt: number } | null {
  const raw = readValue(SHIFT_PROGRESS_KEYS.mileageRequest);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.miles === undefined || parsed.miles === null || parsed.miles === "") return null;
    const miles = Number(parsed.miles);
    if (!Number.isFinite(miles)) return null;
    return {
      date: String(parsed.date || ""),
      miles: Math.max(0, miles),
      requestedAt: Number(parsed.requestedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}