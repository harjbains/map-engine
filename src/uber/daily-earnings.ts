import type { Pence } from "./types.js";

export type EarningsAdjustment = 100 | 500 | 1000 | 2000 | 5000 | -100 | -500 | -1000 | -2000;

export interface DailyEarningsSession {
  originalPence: Pence;
  previewPence: Pence;
  /** Applied deltas only; this is temporary editor UI state. */
  history: Pence[];
}

export function startDailyEarningsSession(originalPence: Pence): DailyEarningsSession {
  return { originalPence, previewPence: Math.max(0, Math.trunc(originalPence)), history: [] };
}

export function adjustDailyEarnings(session: DailyEarningsSession, adjustment: EarningsAdjustment): DailyEarningsSession {
  const previewPence = Math.max(0, session.previewPence + adjustment);
  const applied = previewPence - session.previewPence;
  return applied === 0 ? session : { ...session, previewPence, history: [...session.history, applied] };
}

export function undoDailyEarnings(session: DailyEarningsSession): DailyEarningsSession {
  const applied = session.history.at(-1);
  if (applied === undefined) return session;
  return { ...session, previewPence: Math.max(0, session.previewPence - applied), history: session.history.slice(0, -1) };
}
