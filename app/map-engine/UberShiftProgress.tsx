import { useSyncExternalStore } from "react";
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
// five pounds per ride). Cells count rides by default; very large daily targets
// are grouped so the full width stays a count of roughly one ride per cell
// without turning into a hairline.
const POUNDS_PER_RIDE = 5;
const MAX_VISIBLE_SEGMENTS = 60;

function buildSegments(state: UberShiftState | null): Array<{ filled: boolean; fillPercent: number }> {
  if (!state) {
    return Array.from({ length: 20 }, () => ({ filled: false, fillPercent: 0 }));
  }
  const dailyTarget = Math.max(0, state.dailyTarget);
  const rides = Math.max(1, Math.ceil(dailyTarget / POUNDS_PER_RIDE));
  const group = Math.max(1, Math.ceil(rides / MAX_VISIBLE_SEGMENTS));
  const cells = Math.max(1, Math.ceil(rides / group));
  const earnedRides = Math.max(0, state.todayEarnings) / POUNDS_PER_RIDE;
  const filledCells = earnedRides / group;
  const full = Math.min(cells, Math.floor(filledCells));
  const fraction = Math.min(1, Math.max(0, filledCells - full));
  return Array.from({ length: cells }, (_, index) => {
    if (index < full) return { filled: true, fillPercent: 100 };
    if (index === full) return { filled: false, fillPercent: fraction * 100 };
    return { filled: false, fillPercent: 0 };
  });
}

export function UberShiftProgress({ onOpen }: UberShiftProgressProps) {
  const state = useSyncExternalStore(subscribeShiftProgress, getShiftSnapshot, getShiftServerSnapshot);
  const segments = buildSegments(state);
  const hasData = state !== null;
  const goal = hasData && state.dailyTarget > 0 && state.dailyProgress >= 1;

  return (
    <button
      type="button"
      className={`shift-progress${hasData ? " live" : ""}${goal ? " goal" : ""}`}
      onClick={onOpen}
      aria-label="Open today's Uber Engine shift dashboard"
      title="Uber Engine"
    >
      <span className="shift-track" aria-hidden="true">
        {segments.map((segment, index) =>
          segment.filled ? (
            <span className="shift-seg filled" key={index} />
          ) : segment.fillPercent > 0 ? (
            <span className="shift-seg partial" key={index}>
              <span className="shift-seg-fill" style={{ width: `${segment.fillPercent}%` }} />
            </span>
          ) : (
            <span className="shift-seg" key={index} />
          ),
        )}
      </span>
    </button>
  );
}