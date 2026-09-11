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

function formatClockNow(): string {
  const d = new Date();
  const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
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
  const [phase, setPhase] = useState<"dash" | "edit" | "confirm">("dash");
  const [counterValue, setCounterValue] = useState(() => Math.round(getShiftSnapshot()?.todayEarnings ?? 0));
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
    if (phase === "edit" && state) setCounterValue(Math.round(state.todayEarnings));
    // Only seed the counter when the user opens it, not on every published update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
    setPhase("confirm");
  }, [counterValue, state, todayIso]);

  const dailyProgress = state?.dailyProgress ?? 0;
  const weeklyProgress = state?.weeklyProgress ?? 0;
  const activeMinutes = state?.activeMinutes ?? 0;
  const hourlyRate = state?.hourlyRate ?? 0;
  const targetRate = state?.targetRate ?? 0;

  const dayRequiredMinutes = state ? requiredMinutesFor(state.dailyTarget, targetRate) : null;
  const dayHourProgress = dayRequiredMinutes === null ? null : activeMinutes / dayRequiredMinutes;
  const dayHourLabel = dayRequiredMinutes === null ? null : `${formatHoursMinutes(activeMinutes)} of ${formatHoursMinutes(dayRequiredMinutes)} to target`;

  const weekRequiredMinutes = state ? requiredMinutesFor(state.weeklyTarget, targetRate) : null;
  const weekHourProgress = weekRequiredMinutes === null ? null : state.weeklyMinutes / weekRequiredMinutes;
  const weekHourLabel = weekRequiredMinutes === null ? null : `${formatHoursMinutes(state.weeklyMinutes)} of ${formatHoursMinutes(weekRequiredMinutes)} to target`;

  const dayEstMinutes = hourlyRate > 0 ? Math.ceil((state?.remaining ?? 0) / hourlyRate * 60) : null;
  const weekEstMinutes = hourlyRate > 0 ? Math.ceil((state?.weeklyRemaining ?? 0) / hourlyRate * 60) : null;
  const weekRides = state ? Math.round(Math.max(0, state.weeklyRemaining) / 5) : 0;

  const statusText = !state ? "No shift data" : state.hasActiveShift ? (state.paused ? "Paused" : "Shift live") : "Shift off";

  const updateTotalView = () => {
    if (state) setCounterValue(Math.round(state.todayEarnings));
    else setCounterValue(0);
    setPhase("edit");
  };

  return (
    <div className="shift-scrim" role="presentation" onClick={onClose}>
      {phase === "dash" ? (
        <section
          className="shift-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Uber Engine shift dashboard"
          onClick={(event) => event.stopPropagation()}
        >
          <button ref={closeRef} type="button" className="shift-modal-close" onClick={onClose} aria-label="Close">×</button>

          <header className="shift-head">
            <div className="shift-head-title">
              <span className="shift-eyebrow">UBER ENGINE</span>
              <h2>Shift Progress</h2>
            </div>
            <div className="shift-head-meta">
              <span className="shift-head-date">{formatClockNow()}</span>
              <span className="shift-control-status">
                <i className={`dot${!state ? " off" : state.hasActiveShift ? (state.paused ? " paused" : "") : " off"}`} aria-hidden="true" />
                {statusText}
              </span>
            </div>
          </header>

          <div className="shift-modal-body">
            {state === null ? (
              <>
                <p className="shift-unavailable-eyebrow">NO SHIFT DATA</p>
                <p className="shift-unavailable-title">Shift data unavailable</p>
                <p className="shift-unavailable-note">Open the Uber Engine app once so it can publish today's shift, or sync today's running total below.</p>
              </>
            ) : view === "day" ? (
              <div className="shift-dash">
                <Donut
                  progress={dailyProgress}
                  earnedLabel={formatMoneyWhole(state.todayEarnings)}
                  targetLabel={formatMoneyWhole(state.dailyTarget)}
                  hourProgress={dayHourProgress}
                  hourLabel={dayHourLabel}
                />
                <div className="shift-tiles">
                  <div className="shift-panel">
                    <span>Remaining</span>
                    <strong>{formatMoneyWhole(state.remaining)}</strong>
                    <em>today</em>
                  </div>
                  <div className="shift-panel rides">
                    <span>To target</span>
                    <em>{state.ridesRemaining} rides left</em>
                  </div>
                  <div className="shift-panel">
                    <span>Worked</span>
                    <strong>{formatHoursMinutes(activeMinutes)}</strong>
                    <em>today</em>
                  </div>
                  <div className="shift-panel">
                    <span>Est. remaining</span>
                    <strong>{dayEstMinutes === null ? "—" : formatHoursMinutes(dayEstMinutes)}</strong>
                    <em>at your rate</em>
                  </div>
                  <div className="shift-panel">
                    <span>Your rate</span>
                    <strong>{hourlyRate > 0 ? `£${hourlyRate.toFixed(2)}/h` : "—"}</strong>
                    <em>now</em>
                  </div>
                  <div className="shift-panel">
                    <span>Target rate</span>
                    <strong>{targetRate > 0 ? `£${targetRate.toFixed(2)}/h` : "—"}</strong>
                    <em>to hit target</em>
                  </div>
                </div>
              </div>
            ) : (
              <div className="shift-dash">
                <Donut
                  progress={weeklyProgress}
                  earnedLabel={formatMoneyWhole(state.weeklyEarnings)}
                  targetLabel={formatMoneyWhole(state.weeklyTarget)}
                  hourProgress={weekHourProgress}
                  hourLabel={weekHourLabel}
                />
                <div className="shift-tiles">
                  <div className="shift-panel">
                    <span>Remaining</span>
                    <strong>{formatMoneyWhole(state.weeklyRemaining)}</strong>
                    <em>this week</em>
                  </div>
                  <div className="shift-panel rides">
                    <span>To target</span>
                    <em>{weekRides} rides left</em>
                  </div>
                  <div className="shift-panel">
                    <span>Worked</span>
                    <strong>{formatHoursMinutes(state.weeklyMinutes)}</strong>
                    <em>this week</em>
                  </div>
                  <div className="shift-panel">
                    <span>Est. to target</span>
                    <strong>{weekEstMinutes === null ? "—" : formatHoursMinutes(weekEstMinutes)}</strong>
                    <em>at your rate</em>
                  </div>
                  <div className="shift-panel">
                    <span>Your rate</span>
                    <strong>{hourlyRate > 0 ? `£${hourlyRate.toFixed(2)}/h` : "—"}</strong>
                    <em>now</em>
                  </div>
                  <div className="shift-panel">
                    <span>Target rate</span>
                    <strong>{targetRate > 0 ? `£${targetRate.toFixed(2)}/h` : "—"}</strong>
                    <em>to hit target</em>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="shift-foot">
            {ending ? (
              <div className="shift-end-box">
                <label htmlFor="shift-end-miles">Today's business miles</label>
                <input id="shift-end-miles" type="number" min="0" step="any" inputMode="decimal" placeholder="0" value={endMiles} autoFocus onChange={(event) => setEndMiles(event.target.value)} />
                <button type="button" className="shift-control-btn end" onClick={endShift} disabled={!milesValid}>END SHIFT</button>
                <button type="button" className="shift-control-btn views" onClick={() => { setEnding(false); setEndMiles(""); }}>CANCEL</button>
              </div>
            ) : (
              <div className="shift-controls">
                {!state?.hasActiveShift ? (
                  <>
                    <button type="button" className="shift-control-btn" onClick={() => sendControl("start")}>START SHIFT</button>
                    <button type="button" className="shift-control-btn update" onClick={updateTotalView}>UPDATE EARNINGS</button>
                    <button type="button" className="shift-control-btn views" onClick={() => setView(view === "day" ? "week" : "day")}>{view === "day" ? "WEEK VIEW" : "DAY VIEW"}</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="shift-control-btn pause" onClick={() => sendControl(state.paused ? "resume" : "pause")}>{state.paused ? "RESUME" : "PAUSE"}</button>
                    <button type="button" className="shift-control-btn update" onClick={updateTotalView}>UPDATE EARNINGS</button>
                    <button type="button" className="shift-control-btn end" onClick={() => setEnding(true)}>END SHIFT</button>
                    <button type="button" className="shift-control-btn views" onClick={() => setView(view === "day" ? "week" : "day")}>{view === "day" ? "WEEK VIEW" : "DAY VIEW"}</button>
                  </>
                )}
              </div>
            )}
          </div>
          {controlNote && <p className="shift-end-note" role="status">Shift command sent to the Uber Engine app.</p>}
        </section>
      ) : (
        <section
          className="shift-modal small"
          role="dialog"
          aria-modal="true"
          aria-label="Update today's earnings"
          onClick={(event) => event.stopPropagation()}
        >
          <button ref={closeRef} type="button" className="shift-modal-close" onClick={onClose} aria-label="Close">×</button>
          {phase === "edit" ? (
            <div className="shift-update">
              <p className="shift-update-eyebrow">UPDATE EARNINGS</p>
              <h2>Set your current total for today</h2>
              <div className="shift-update-total">
                <span>Current total</span>
                <strong>{formatMoneyWhole(counterValue)}</strong>
              </div>
              <div className="shift-counter-row" aria-label="Today's running total counter">
                {COUNTER_STEPS.map((step) => (
                  <div key={step.value} className="shift-counter-block">
                    <button type="button" onClick={() => adjust(step.value, 1)} aria-label={`Add ${step.label}`}>+</button>
                    <button type="button" onClick={() => adjust(step.value, -1)} aria-label={`Subtract ${step.label}`}>−</button>
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
              <div className="shift-update-actions">
                <button type="button" className="shift-counter-save" onClick={save}>✓ SAVE &amp; UPDATE</button>
                <button type="button" className="shift-counter-cancel" onClick={() => setPhase("dash")}>CANCEL</button>
              </div>
            </div>
          ) : (
            <div className="shift-confirm">
              <span className="shift-confirm-tick" aria-hidden="true">✓</span>
              <p className="shift-update-eyebrow">EARNINGS UPDATED</p>
              <strong className="shift-confirm-total">{formatMoneyWhole(counterValue)}</strong>
              <span className="shift-confirm-note">Total earnings for today</span>
              <div className="shift-confirm-actions">
                <button type="button" className="shift-counter-save" onClick={() => setPhase("dash")}>BACK TO DASHBOARD</button>
                <button type="button" className="shift-counter-cancel" onClick={() => setPhase("edit")}>ADJUST TOTAL AGAIN</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}