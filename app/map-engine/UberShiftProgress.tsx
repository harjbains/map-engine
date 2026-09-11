import { useSyncExternalStore, type CSSProperties } from "react";
import { parseShiftStateCached, type UberShiftState } from "../lib/shift-progress";

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
    return parseShiftStateCached((key) => window.localStorage.getItem(key));
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

// Each visible cell on the bottom jobs bar represents a single ride (roughly
// five pounds per ride). The bar is scaled dynamically to the daily target
// plus a ten-ride tail so the goal never sits flush against the edge: cells
// count rides by default and only very large daily targets are grouped so the
// full width never turns into a hairline.
const POUNDS_PER_RIDE = 5;
const MAX_VISIBLE_SEGMENTS = 60;

function buildBar(state: UberShiftState | null): {
  segments: Array<{ filled: boolean; fillPercent: number }>;
  group: number;
  cells: number;
} {
  if (!state) {
    return { segments: Array.from({ length: 20 }, () => ({ filled: false, fillPercent: 0 })), group: 1, cells: 20 };
  }
  const dailyTarget = Math.max(0, state.dailyTarget);
  const rides = Math.max(1, Math.ceil(dailyTarget / POUNDS_PER_RIDE));
  const scale = rides + 10;
  const group = Math.max(1, Math.ceil(scale / MAX_VISIBLE_SEGMENTS));
  const cells = Math.max(1, Math.ceil(scale / group));
  const earnedRides = Math.max(0, state.todayEarnings) / POUNDS_PER_RIDE;
  const filledCells = earnedRides / group;
  const full = Math.min(cells, Math.floor(filledCells));
  const fraction = Math.min(1, Math.max(0, filledCells - full));
  const segments = Array.from({ length: cells }, (_, index) => {
    if (index < full) return { filled: true, fillPercent: 100 };
    if (index === full) return { filled: false, fillPercent: fraction * 100 };
    return { filled: false, fillPercent: 0 };
  });
  return { segments, group, cells };
}

export function UberShiftProgress({ onOpen }: UberShiftProgressProps) {
  const state = useSyncExternalStore(subscribeShiftProgress, getShiftSnapshot, getShiftServerSnapshot);
  const bar = buildBar(state);
  const hasData = state !== null;
  const goal = hasData && state.dailyTarget > 0 && state.dailyProgress >= 1;

  return (
    <button
      type="button"
      className={`shift-progress${hasData ? " live" : ""}${goal ? " goal" : ""}`}
      onClick={onOpen}
      aria-label="Open today's Uber Engine shift dashboard"
      title="Uber Engine"
      style={{ "--cells": bar.cells } as CSSProperties}
    >
      <span className="shift-track" aria-hidden="true">
        {bar.segments.map((segment, index) => {
          const label = hasData && (index + 1 === 1 || (index + 1) % 5 === 0) ? (index + 1) * bar.group : null;
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
    </button>
  );
}