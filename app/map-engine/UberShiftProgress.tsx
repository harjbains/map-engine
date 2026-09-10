import { useSyncExternalStore } from "react";
import { parseShiftProgress, parseShiftState } from "../lib/shift-progress";

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

function getShiftSnapshot(): number | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
  try {
    const read = (key: string) => window.localStorage.getItem(key);
    const state = parseShiftState(read);
    if (state) return state.shiftActive ? state.dailyProgress : null;
    return parseShiftProgress(read);
  } catch {
    return null;
  }
}

function getShiftServerSnapshot(): number | null {
  return null;
}

export type UberShiftProgressProps = {
  onOpen: () => void;
};

export function UberShiftProgress({ onOpen }: UberShiftProgressProps) {
  const progress = useSyncExternalStore(subscribeShiftProgress, getShiftSnapshot, getShiftServerSnapshot);
  const percent = progress === null ? 0 : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const hasData = progress !== null;
  const goal = hasData && percent >= 100;

  return (
    <button
      type="button"
      className={`shift-progress${hasData ? " live" : ""}${goal ? " goal" : ""}`}
      onClick={onOpen}
      aria-label="Open today's Uber Engine shift dashboard"
      title="Uber Engine"
    >
      <span className="shift-track" aria-hidden="true">
        <span className="shift-fill" style={{ width: `${percent}%` }} />
        <i className="shift-tick" style={{ left: "50%" }} />
        <i className="shift-tick" style={{ left: "75%" }} />
        <i className="shift-goal" style={{ left: "100%" }} />
      </span>
    </button>
  );
}