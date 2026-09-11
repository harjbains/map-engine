import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { SHIFT_CYCLE_POUNDS, SHIFT_CYCLE_SEGMENTS, shiftCycle, snapshotShiftState, type UberShiftState } from "../lib/shift-progress";

const CYCLE_FLASH_MS = 1100;

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

// The collapsed bar is a motivational 25-pound block split into five equal 5-pound
// cells. It answers "how close am I to finishing the next twenty-five pounds" rather
// than scaling to a whole day's target, so every visibly-sized fare advances the bar.
// The fill is derived from the persisted running total (todayEarnings modulo 25)
// with partial cells allowed, so the bar can never drift from the authoritative
// daily figure. Cells are plain visual blocks - no stage numbers, levels or ride
// counts - and the daily and weekly totals and the Uber Engine donut remain the
// real targets.
function buildCycleBar(state: UberShiftState | null): {
  cycle: number;
  cycled: number;
  completed: boolean;
  segments: Array<{ filled: boolean; fillPercent: number }>;
} {
  if (!state) {
    return {
      cycle: 0,
      cycled: 0,
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
  return { cycle, cycled, completed, segments };
}

export function UberShiftProgress({ onOpen }: UberShiftProgressProps) {
  const state = useSyncExternalStore(subscribeShiftProgress, getShiftSnapshot, getShiftServerSnapshot);
  const bar = buildCycleBar(state);
  const hasData = state !== null;

  // The flash is change-driven, not mount-driven: a fresh load at 32 lands
  // silently on the next cycle, but a live update that crosses a 25-pound boundary
  // first shows the completed old bar at 100% with a green pulse, then swaps to
  // the new cycle carrying the remainder. displayedCycle lags the derived cycle
  // by the flash duration so the boundary is acknowledged before the reset.
  const [displayedCycle, setDisplayedCycle] = useState(() => bar.cycle);
  const [celebrating, setCelebrating] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setDisplayedCycle(bar.cycle);
      return;
    }
    if (bar.cycle === displayedCycle) return;
    if (bar.cycle > displayedCycle) setCelebrating(true);
    setDisplayedCycle(bar.cycle);
  }, [bar.cycle, displayedCycle]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = setTimeout(() => setCelebrating(false), CYCLE_FLASH_MS);
    return () => clearTimeout(timer);
  }, [celebrating]);

  const segments = celebrating
    ? Array.from({ length: SHIFT_CYCLE_SEGMENTS }, () => ({ filled: true, fillPercent: 100 }))
    : bar.segments;

  return (
    <button
      type="button"
      className={`shift-progress${hasData ? " live" : ""}${celebrating ? " goal" : ""}`}
      onClick={onOpen}
      aria-label="Open today's Uber Engine shift dashboard"
      title="Uber Engine"
      data-cycle={displayedCycle}
      data-completed={celebrating ? "1" : "0"}
      style={{ "--cells": SHIFT_CYCLE_SEGMENTS } as CSSProperties}
    >
      <span className="shift-track" aria-hidden="true">
        {segments.map((segment, index) => {
          if (segment.filled) {
            return <span className="shift-seg filled" key={index} />;
          }
          if (segment.fillPercent > 0) {
            return (
              <span className="shift-seg partial" key={index}>
                <span className="shift-seg-fill" style={{ width: `${segment.fillPercent}%` }} />
              </span>
            );
          }
          return <span className="shift-seg" key={index} />;
        })}
      </span>
      {celebrating && <span className="shift-cycle-flash" key={displayedCycle} aria-hidden="true" />}
    </button>
  );
}