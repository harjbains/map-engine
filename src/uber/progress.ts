import type { Pence } from "./types.js";

export const UBER_CYCLE_PENCE = 2_500;
export const UBER_SEGMENT_PENCE = 500;

/** Five £5 cells, derived solely from the V3 today's-earnings actual. */
export function uberProgressCycle(earningsPence: Pence): number[] {
  const safeEarnings = Math.max(0, Math.trunc(earningsPence));
  const remainder = safeEarnings % UBER_CYCLE_PENCE;
  const displayed = safeEarnings > 0 && remainder === 0 ? UBER_CYCLE_PENCE : remainder;
  return Array.from({ length: 5 }, (_, index) => Math.max(0, Math.min(100, ((displayed - index * UBER_SEGMENT_PENCE) / UBER_SEGMENT_PENCE) * 100)));
}
