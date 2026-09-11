import { useSyncExternalStore, type CSSProperties } from "react";
import { SHIFT_CYCLE_POUNDS, SHIFT_CYCLE_SEGMENTS, shiftCycle, snapshotShiftState, type UberShiftState } from "../lib/shift-progress";

function subscribeShiftProgress(callback: () => void) {
  const refresh = () => callback();
  window.addEventListener("storage", refresh);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("uber-engine-shift-state-local", refresh);
  return () => {
    window.removeEventListener("storage", refresh);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("uber-engine-shift-state-local", refresh);
  };
}

function getShiftSnapshot(): UberShiftState | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
  try {
    return snapshotShiftState(
      (key) => window.localStorage.getItem(key),
      (key, value) => window.localStorage.setItem(key, value),
    );
  } catch {
    return null;
  }
}

function getShiftServerSnapshot(): UberShiftState | null {
  return null;
}

export type UberShiftProgressProps = {
  onOpen: () => void;
};

// The collapsed bar is a motivational cycle: five segments of five pounds each
// repeat. It answers "what is the short amount I am building toward right now"
// rather than scaling to a whole day's target, so every visibly-sized fare
// advances the cycle. The position is derived from the persisted running total
// (todayEarnings modulo the 25-pound cycle) with partial segments allowed, so
// the bar can never drift from the authoritative daily figure. The daily and
// weekly totals and the Uber Engine donut remain the real targets.
function buildCycleBar(state: UberShiftState | null): {
  cycle: number;
  completed: boolean;
  segments: Array<{ filled: boolean; fillPercent: number }>;
} {
  if (!state) {
    return {
      cycle: 0,
      completed: false,
      segments: Array.from({ length: SHIFT_CYCLE_SEGMENTS }, () => ({ filled: false, fillPercent: 0 })),
    };
  }
  const { cycle, cycled, completed } = shiftCycle(state.todayEarnings);
  const units = (cycled / SHIFT_CYCLE_POUNDS) * SHIFT_CYCLE_SEGMENTS;
  const full = Math.min(SHIFT_CYCLE_SEGMENTS, Math.floor(units));
  const fraction = Math.min(1, Math.max(0, units - full));
  const segments = Array.from({ length: SHIFT_CYCLE_SEGMENTS }, (_, index) => {
    if (index < full) return { filled: true, fillPercent: 100 };
    if (index === full) return { filled: false, fillPercent: fraction * 100 };
    return { filled: false, fillPercent: 0 };
  });
  return { cycle, completed, segments };
}

export function UberShiftProgress({ onOpen }: UberShiftProgressProps) {
  const state = useSyncExternalStore(subscribeShiftProgress, getShiftSnapshot, getShiftServerSnapshot);
  const bar = buildCycleBar(state);
  const hasData = state !== null;
  const goal = hasData && bar.completed;

  return (
    <button
      type="button"
      className={`shift-progress${hasData ? " live" : ""}${goal ? " goal" : ""}`}
      onClick={onOpen}
      aria-label="Open today's Uber Engine shift dashboard"
      title="Uber Engine"
      data-cycle={bar.cycle}
      data-completed={bar.completed ? "1" : "0"}
      style={{ "--cells": SHIFT_CYCLE_SEGMENTS } as CSSProperties}
    >
      <span className="shift-track" aria-hidden="true">
        {bar.segments.map((segment, index) => {
          const label = hasData ? index + 1 : null;
          if (segment.filled) {
            return (
              <span className="shift-seg filled" key={index}>
                {label !== null && <b>{label}</b>}
              </span>
            );
          }
          if (segment.fillPercent > 0) {
            return (
              <span className="shift-seg partial" key={index}>
                <span className="shift-seg-fill" style={{ width: `${segment.fillPercent}%` }} />
                {label !== null && <b>{label}</b>}
              </span>
            );
          }
          return (
            <span className="shift-seg" key={index}>
              {label !== null && <b>{label}</b>}
            </span>
          );
        })}
      </span>
      {bar.cycle > 0 && <span className="shift-cycle-flash" key={bar.cycle} aria-hidden="true" />}
    </button>
  );
}