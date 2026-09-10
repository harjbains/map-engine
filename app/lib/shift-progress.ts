// Uber Engine shift-progress integration contract.
//
// Uber Engine is authoritative for earnings and shift calculations. Map Engine
// consumes ONLY these published keys and never inspects Uber Engine's internal
// storage structure. The full contract lives at
// docs/Uber-Shift-Progress-Integration.md.
//
// Both apps are deployed under the harjbains.github.io origin, so they share
// one browser localStorage namespace. Every failure mode returns null so Map
// Engine simply draws nothing and keeps rendering the map normally.

export const SHIFT_PROGRESS_KEYS = {
  progress: "uberEngine.shift.progress",
  active: "uberEngine.shift.active",
  updatedAt: "uberEngine.shift.updatedAt",
} as const;

export const SHIFT_PROGRESS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type ShiftProgressReadValue = (key: string) => string | null;

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