import { useSyncExternalStore } from "react";
import { UBER_ENGINE_URL } from "./config";
import { parseShiftProgress } from "../lib/shift-progress";

function subscribeShiftProgress(callback: () => void) {
  const refresh = () => callback();
  window.addEventListener("storage", refresh);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  return () => {
    window.removeEventListener("storage", refresh);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
  };
}

function getShiftProgressSnapshot(): number | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
  try {
    return parseShiftProgress((key) => window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function getShiftProgressServerSnapshot(): number | null {
  return null;
}

export function UberShiftProgress() {
  const progress = useSyncExternalStore(subscribeShiftProgress, getShiftProgressSnapshot, getShiftProgressServerSnapshot);
  if (progress === null) return null;

  const percent = Math.round(progress * 100);
  const goal = percent >= 100;

  return (
    <button
      type="button"
      className={`shift-progress${goal ? " goal" : ""}`}
      onClick={() => { window.location.assign(UBER_ENGINE_URL); }}
      aria-label="Open the Uber Engine dashboard"
      title="Uber Engine"
    >
      <span className="shift-track" aria-hidden="true">
        <span className="shift-fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        <i className="shift-tick" style={{ left: "50%" }} />
        <i className="shift-tick" style={{ left: "75%" }} />
        <i className="shift-goal" style={{ left: "100%" }} />
      </span>
    </button>
  );
}