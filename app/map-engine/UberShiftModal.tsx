import { Component, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { buildControlRequest, buildSyncRequest, parseShiftStateCached, SHIFT_PROGRESS_KEYS, type UberShiftState } from "../lib/shift-progress";

function subscribeShift(callback: () => void) {
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

function formatMoneyWhole(value: number): string {
  return value.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
}

function formatHoursMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.round(minutes));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function requiredMinutesFor(target: number, targetRate: number): number | null {
  if (target <= 0 || targetRate <= 0) return null;
  return (target / targetRate) * 60;
}

function Donut({ progress, earnedLabel, targetLabel, hourProgress, hourLabel }: { progress: number; earnedLabel: string; targetLabel: string; hourProgress: number | null; hourLabel: string | null }) {
  const radius = 120;
  const innerRadius = 86;
  const circumference = 2 * Math.PI * radius;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const clamped = Math.min(1, Math.max(0, progress));
  const dash = clamped * circumference;
  const hourClamped = hourProgress === null ? 0 : Math.min(1, Math.max(0, hourProgress));
  const hourDash = hourClamped * innerCircumference;
  return (
    <div className="shift-donut-wrap">
      <svg className="shift-donut" viewBox="0 0 280 280" role="img" aria-label={`${Math.round(clamped * 100)} percent of target`}>
        <circle className="shift-donut-track" cx="140" cy="140" r={radius} />
        <circle
          className="shift-donut-fill"
          cx="140"
          cy="140"
          r={radius}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset="0"
          transform="rotate(-90 140 140)"
        />
        <circle className="shift-donut-track inner" cx="140" cy="140" r={innerRadius} />
        <circle
          className={hourClamped >= 1 ? "shift-donut-fill inner complete" : "shift-donut-fill inner"}
          cx="140"
          cy="140"
          r={innerRadius}
          strokeDasharray={`${hourDash} ${innerCircumference - hourDash}`}
          strokeDashoffset="0"
          transform="rotate(-90 140 140)"
        />
      </svg>
      <div className="shift-donut-centre" aria-hidden="true">
        <strong>{earnedLabel}</strong>
        <span>of {targetLabel}</span>
        <em>{Math.round(clamped * 100)}%</em>
        {hourLabel ? <small className="shift-donut-hrs">{hourLabel}</small> : null}
      </div>
    </div>
  );
}

type CounterStep = { label: string; value: 100 | 10 | 1 };

const COUNTER_STEPS: CounterStep[] = [
  { label: "£100", value: 100 },
  { label: "£10", value: 10 },
  { label: "£1", value: 1 },
];

export type UberShiftModalProps = {
  onClose: () => void;
};

// Guard rails: if the modal subtree ever throws, fall back to closing it rather
// than letting React unmount the whole dashboard to a blank screen.
type ShiftModalBoundaryProps = { onClose: () => void; children: ReactNode };
type ShiftModalBoundaryState = { failed: boolean };

export class ShiftModalBoundary extends Component<ShiftModalBoundaryProps, ShiftModalBoundaryState> {
  state: ShiftModalBoundaryState = { failed: false };

  static getDerivedStateFromError(): ShiftModalBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("Uber Shift modal crashed:", error);
  }

  componentDidUpdate(_prevProps: ShiftModalBoundaryProps, prevState: ShiftModalBoundaryState) {
    if (this.state.failed && !prevState.failed) this.props.onClose();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export function UberShiftModal({ onClose }: UberShiftModalProps) {
  const state = useSyncExternalStore(subscribeShift, getShiftSnapshot, getShiftServerSnapshot);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<"day" | "week">("day");
  const [editing, setEditing] = useState(false);
  const [counterValue, setCounterValue] = useState(() => Math.round(getShiftSnapshot()?.todayEarnings ?? 0));
  const [saved, setSaved] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endMiles, setEndMiles] = useState("");
  const [controlNote, setControlNote] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (editing && state) setCounterValue(Math.round(state.todayEarnings));
    // Only seed the counter when the user opens it, not on every published update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const todayIso = useMemo(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 10);
  }, []);

  const adjust = useCallback((step: number, delta: 1 | -1) => {
    setCounterValue((current) => Math.max(0, current + step * delta));
  }, []);

  const sendControl = useCallback((action: "start" | "pause" | "resume" | "end", options: { miles?: number } = {}) => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
    try {
      window.localStorage.setItem(SHIFT_PROGRESS_KEYS.controlRequest, buildControlRequest(action, options));
      if (state) {
        const optimistic: UberShiftState = {
          ...state,
          shiftActive: action === "start" || action === "resume",
          paused: action === "pause",
          hasActiveShift: action !== "end",
          updatedAt: Date.now(),
        };
        window.localStorage.setItem(SHIFT_PROGRESS_KEYS.state, JSON.stringify(optimistic));
      }
      window.dispatchEvent(new Event("uber-engine-shift-state-local"));
      setControlNote(true);
      window.setTimeout(() => setControlNote(false), 3000);
    } catch {
      // Best effort: the Uber Engine app will pick the request up only if it lands.
    }
  }, [state]);

  const endShift = useCallback(() => {
    const miles = Number(endMiles);
    if (!Number.isFinite(miles) || miles < 0) return;
    sendControl("end", { miles });
    setEnding(false);
    setEndMiles("");
  }, [endMiles, sendControl]);

  const milesValid = endMiles.trim() !== "" && Number.isFinite(Number(endMiles)) && Number(endMiles) >= 0;

  const save = useCallback(() => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
    const total = Math.round(counterValue);
    const date = state?.date || todayIso;
    const now = Date.now();
    try {
      window.localStorage.setItem(SHIFT_PROGRESS_KEYS.syncRequest, buildSyncRequest(date, total));
      if (state) {
        const dailyTarget = state.dailyTarget;
        const activeMinutes = state.activeMinutes;
        const optimistic: UberShiftState = {
          ...state,
          todayEarnings: total,
          dailyProgress: Math.min(1, dailyTarget > 0 ? Math.max(0, total / dailyTarget) : 0),
          remaining: dailyTarget > 0 ? Math.max(0, Math.round(dailyTarget - total)) : 0,
          ridesRemaining: dailyTarget > 0 ? Math.max(0, Math.round(Math.max(0, dailyTarget - total) / 5)) : 0,
          hourlyRate: activeMinutes > 0 ? Math.round((total / (activeMinutes / 60)) * 100) / 100 : state.hourlyRate,
          updatedAt: now,
        };
        window.localStorage.setItem(SHIFT_PROGRESS_KEYS.state, JSON.stringify(optimistic));
      } else {
        const optimistic: UberShiftState = {
          version: 1,
          date,
          shiftActive: true,
          paused: false,
          hasActiveShift: false,
          dailyTarget: total,
          todayEarnings: total,
          dailyProgress: 1,
          remaining: 0,
          ridesRemaining: 0,
          activeMinutes: 0,
          hourlyRate: 0,
          targetRate: 0,
          weeklyTarget: 0,
          weeklyEarnings: 0,
          weeklyProgress: 0,
          weeklyMinutes: 0,
          weeklyRemaining: 0,
          updatedAt: now,
        };
        window.localStorage.setItem(SHIFT_PROGRESS_KEYS.state, JSON.stringify(optimistic));
      }
      window.dispatchEvent(new Event("uber-engine-shift-state-local"));
    } catch {
      window.dispatchEvent(new Event("shift-sync-failed"));
    }
    setEditing(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }, [counterValue, state, todayIso]);

  if (state === null) {
    return (
      <div className="shift-scrim" role="presentation" onClick={onClose}>
        <section className="shift-modal" role="dialog" aria-modal="true" aria-label="Uber Engine shift dashboard" onClick={(event) => event.stopPropagation()}>
          <button ref={closeRef} type="button" className="shift-modal-close" onClick={onClose} aria-label="Close">×</button>
          <p className="shift-unavailable-eyebrow">UBER ENGINE</p>
          <h2 className="shift-unavailable-title">Shift data unavailable</h2>
          <p className="shift-unavailable-note">Open the Uber Engine app once so it can publish today's shift, or sync today's running total below.</p>
          <div className="shift-controls">
            <button type="button" className="shift-control-btn" onClick={() => sendControl("start")}>START SHIFT</button>
            <span className="shift-control-status"><i className="dot off" aria-hidden="true" />No shift data</span>
          </div>
          {controlNote && <p className="shift-end-note" role="status">Shift command sent to the Uber Engine app.</p>}
          {!editing ? (
            <button type="button" className="shift-counter-open" onClick={() => { setCounterValue(0); setEditing(true); }}>SYNC TODAY'S TOTAL</button>
          ) : (
            <div className="shift-editor">
              <p className="shift-editor-label">SYNC TODAY'S TOTAL</p>
              <div className="shift-counter-row" aria-label="Today's running total counter">
                {COUNTER_STEPS.map((step) => (
                  <div key={step.value} className="shift-counter-block">
                    <button type="button" onClick={() => adjust(step.value, 1)} aria-label={`Add ${step.label}`}>+</button>
                    <button type="button" onClick={() => adjust(step.value, -1)} aria-label={`Subtract ${step.label}`}>−</button>
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
              <strong className="shift-counter-total">{formatMoneyWhole(counterValue)}</strong>
              <button type="button" className="shift-counter-save" onClick={save}>SAVE &amp; UPDATE</button>
              <button type="button" className="shift-counter-cancel" onClick={() => setEditing(false)}>CANCEL</button>
              {saved && <p className="shift-saved-note" role="status">Saved — today's total is synced to the Uber Engine app.</p>}
            </div>
          )}
        </section>
      </div>
    );
  }

  const dailyProgress = state.dailyProgress;
  const weeklyProgress = state.weeklyProgress;
  const activeMinutes = state.activeMinutes;
  const hourlyRate = state.hourlyRate;
  const targetRate = state.targetRate;

  const dayRequiredMinutes = requiredMinutesFor(state.dailyTarget, targetRate);
  const dayHourProgress = dayRequiredMinutes === null ? null : activeMinutes / dayRequiredMinutes;
  const dayHourLabel = dayRequiredMinutes === null ? null : `${formatHoursMinutes(activeMinutes)} of ${formatHoursMinutes(dayRequiredMinutes)} to target`;

  const weekRequiredMinutes = requiredMinutesFor(state.weeklyTarget, targetRate);
  const weekHourProgress = weekRequiredMinutes === null ? null : state.weeklyMinutes / weekRequiredMinutes;
  const weekHourLabel = weekRequiredMinutes === null ? null : `${formatHoursMinutes(state.weeklyMinutes)} of ${formatHoursMinutes(weekRequiredMinutes)} to target`;

  return (
    <div className="shift-scrim" role="presentation" onClick={onClose}>
      <section
        className="shift-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Uber Engine shift dashboard"
        onClick={(event) => event.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="shift-modal-close" onClick={onClose} aria-label="Close">×</button>

        <div className="shift-tabs" role="tablist" aria-label="Shift dashboard view">
          <button type="button" role="tab" aria-selected={view === "day"} className={view === "day" ? "active" : ""} onClick={() => setView("day")}>DAY</button>
          <button type="button" role="tab" aria-selected={view === "week"} className={view === "week" ? "active" : ""} onClick={() => setView("week")}>WEEK</button>
        </div>

        {view === "day" ? (
          <>
            {ending ? (
              <div className="shift-end-box">
                <label htmlFor="shift-end-miles">Today's business miles</label>
                <input id="shift-end-miles" type="number" min="0" step="any" inputMode="decimal" placeholder="0" value={endMiles} autoFocus onChange={(event) => setEndMiles(event.target.value)} />
                <button type="button" className="shift-control-btn end" onClick={endShift} disabled={!milesValid}>END SHIFT</button>
                <button type="button" className="shift-control-btn" onClick={() => { setEnding(false); setEndMiles(""); }}>CANCEL</button>
              </div>
            ) : (
              <div className="shift-controls">
                {!state.hasActiveShift ? (
                  <button type="button" className="shift-control-btn" onClick={() => sendControl("start")}>START SHIFT</button>
                ) : (
                  <>
                    <button type="button" className="shift-control-btn" onClick={() => sendControl(state.paused ? "resume" : "pause")}>{state.paused ? "RESUME" : "PAUSE"}</button>
                    <button type="button" className="shift-control-btn end" onClick={() => setEnding(true)}>END SHIFT</button>
                  </>
                )}
                <span className="shift-control-status">
                  <i className={`dot${state.hasActiveShift ? (state.paused ? " paused" : "") : " off"}`} aria-hidden="true" />
                  {state.hasActiveShift ? (state.paused ? "Paused" : "Shift live") : "Shift off"}
                </span>
              </div>
            )}
            {controlNote && <p className="shift-end-note" role="status">Shift command sent to the Uber Engine app.</p>}
          </>
        ) : null}

        {view === "day" ? (
          <div className="shift-modal-body">
            <Donut
              progress={dailyProgress}
              earnedLabel={formatMoneyWhole(state.todayEarnings)}
              targetLabel={formatMoneyWhole(state.dailyTarget)}
              hourProgress={dayHourProgress}
              hourLabel={dayHourLabel}
            />

            <div className="shift-panels">
              <div className="shift-panel">
                <span>Remaining</span>
                <strong>{formatMoneyWhole(state.remaining)}</strong>
                <em>{state.ridesRemaining} rides left</em>
              </div>
              <div className="shift-panel">
                <span>Worked</span>
                <strong>{formatHoursMinutes(activeMinutes)}</strong>
                <em>productive time</em>
              </div>
              <div className="shift-panel">
                <span>Rate</span>
                <strong>{hourlyRate > 0 ? `£${hourlyRate.toFixed(2)}/h` : "—"}</strong>
                <em>{targetRate > 0 ? `${targetRate.toFixed(2)}/h target` : ""}</em>
              </div>
            </div>

            {!editing ? (
              <button type="button" className="shift-counter-open" onClick={() => { setCounterValue(Math.round(state.todayEarnings)); setEditing(true); }}>SYNC TODAY'S TOTAL</button>
            ) : (
              <div className="shift-editor">
                <p className="shift-editor-label">SYNC TODAY'S TOTAL</p>
                <div className="shift-counter-row" aria-label="Today's running total counter">
                  {COUNTER_STEPS.map((step) => (
                    <div key={step.value} className="shift-counter-block">
                      <button type="button" onClick={() => adjust(step.value, 1)} aria-label={`Add ${step.label}`}>+</button>
                      <button type="button" onClick={() => adjust(step.value, -1)} aria-label={`Subtract ${step.label}`}>−</button>
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
                <strong className="shift-counter-total">{formatMoneyWhole(counterValue)}</strong>
                <div className="shift-editor-actions">
                  <button type="button" className="shift-counter-save" onClick={save}>SAVE &amp; UPDATE</button>
                  <button type="button" className="shift-counter-cancel" onClick={() => setEditing(false)}>CANCEL</button>
                </div>
                {saved && <p className="shift-saved-note" role="status">Saved — today's total is synced to the Uber Engine app.</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="shift-modal-body">
            <Donut
              progress={weeklyProgress}
              earnedLabel={formatMoneyWhole(state.weeklyEarnings)}
              targetLabel={formatMoneyWhole(state.weeklyTarget)}
              hourProgress={weekHourProgress}
              hourLabel={weekHourLabel}
            />

            <div className="shift-panels">
              <div className="shift-panel">
                <span>Remaining</span>
                <strong>{formatMoneyWhole(state.weeklyRemaining)}</strong>
                <em>this week</em>
              </div>
              <div className="shift-panel">
                <span>Worked</span>
                <strong>{formatHoursMinutes(state.weeklyMinutes)}</strong>
                <em>this week</em>
              </div>
              <div className="shift-panel">
                <span>Target</span>
                <strong>{formatMoneyWhole(state.weeklyTarget)}</strong>
                <em>weekly</em>
              </div>
            </div>

            <p className="shift-week-note">Weekly totals come from the Uber Engine app. Open it to review full planning detail.</p>
          </div>
        )}
      </section>
    </div>
  );
}