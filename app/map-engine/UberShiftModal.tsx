import { Component, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { buildControlRequest, buildMileageRequest, buildSyncRequest, parseShiftStateCached, SHIFT_PROGRESS_KEYS, type UberShiftState } from "../lib/shift-progress";
import { isoOf, readBusinessMiles, readShiftDays, rememberDay, setTodaysMiles, weekDays, weekMiles } from "../lib/business-miles";

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

// TESLA UI:
// The following analytical helpers are intentionally NOT rendered. The lean
// dashboard answers only four questions (daily target, weekly target, actual
// gross £/productive hour, recorded business mileage). The estimation logic is
// preserved below for possible future restoration.
//
// function requiredMinutesFor(target: number, targetRate: number): number | null {
//   if (target <= 0 || targetRate <= 0) return null;
//   return (target / targetRate) * 60;
// }
//
// Projections that were previously derived and are now hidden:
//   - estimated minutes remaining today (dayEstMinutes)
//   - estimated minutes to weekly target (weekEstMinutes)
//   - rides remaining this week (weekRides)
//   - worked-vs-required hour ring (dayHourProgress / weekHourProgress)

function Donut({ pct, earnedLabel, targetLabel }: { pct: number; earnedLabel: string; targetLabel: string }) {
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, pct));
  const dash = clamped * circumference;
  const over = pct > 1;
  return (
    <div className="shift-donut-wrap">
      <svg className="shift-donut" viewBox="0 0 280 280" role="img" aria-label={`${Math.round(pct * 100)} percent of target`}>
        <circle className="shift-donut-track" cx="140" cy="140" r={radius} />
        <circle
          className={`shift-donut-fill${over ? " over" : ""}${clamped >= 1 ? " complete" : ""}`}
          cx="140"
          cy="140"
          r={radius}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset="0"
          transform="rotate(-90 140 140)"
        />
      </svg>
      <div className="shift-donut-centre" aria-hidden="true">
        <strong>{earnedLabel}</strong>
        <span>of {targetLabel}</span>
        <em className={over ? "over" : ""}>{Math.round(pct * 100)}%</em>
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
  const [phase, setPhase] = useState<"dash" | "week" | "edit" | "confirm" | "miles" | "mile-confirm">("dash");
  const [counterValue, setCounterValue] = useState(() => Math.round(getShiftSnapshot()?.todayEarnings ?? 0));
  const [milesValue, setMilesValue] = useState(0);
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
    if (phase === "miles" && state) setMilesValue(Math.round(businessMiles().today));
    // Only seed the editors when the user opens them, not on every published update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const todayIso = useMemo(() => isoOf(Date.now()), []);

  const adjust = useCallback((step: number, delta: 1 | -1) => {
    setCounterValue((current) => Math.max(0, current + step * delta));
  }, []);

  const adjustMiles = useCallback((delta: number) => {
    setMilesValue((current) => Math.max(0, current + delta));
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
    // Record the end-of-shift business miles against today and the week too, so
    // the lean dashboard keeps its own record even before Uber Engine republishes.
    const date = state?.date || todayIso;
    const { week } = setTodaysMiles(miles);
    try {
      window.localStorage.setItem(SHIFT_PROGRESS_KEYS.mileageRequest, buildMileageRequest(date, miles));
      if (state) {
        const currentWeek = state.businessMilesWeek > 0 || state.businessMilesToday > 0 ? state.businessMilesWeek - state.businessMilesToday + miles : week;
        const optimistic: UberShiftState = {
          ...state,
          shiftActive: false,
          paused: false,
          hasActiveShift: false,
          businessMilesToday: miles,
          businessMilesWeek: currentWeek,
          updatedAt: Date.now(),
        };
        window.localStorage.setItem(SHIFT_PROGRESS_KEYS.state, JSON.stringify(optimistic));
        window.dispatchEvent(new Event("uber-engine-shift-state-local"));
      }
    } catch {
      // Best effort.
    }
    setEnding(false);
    setEndMiles("");
  }, [endMiles, sendControl, state, todayIso]);

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
          businessMilesToday: 0,
          businessMilesWeek: 0,
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

  const saveMiles = useCallback(() => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
    const miles = Number(milesValue);
    if (!Number.isFinite(miles) || miles < 0) return;
    const date = state?.date || todayIso;
    const now = Date.now();
    // Keep the driver's own per-date record current, and ask Uber Engine to stay
    // authoritative through the dedicated mileage request channel.
    const { week } = setTodaysMiles(miles);
    try {
      window.localStorage.setItem(SHIFT_PROGRESS_KEYS.mileageRequest, buildMileageRequest(date, miles, now));
      if (state) {
        const currentWeek = state.businessMilesWeek > 0 || state.businessMilesToday > 0 ? state.businessMilesWeek - state.businessMilesToday + miles : week;
        const optimistic: UberShiftState = {
          ...state,
          businessMilesToday: miles,
          businessMilesWeek: currentWeek,
          updatedAt: now,
        };
        window.localStorage.setItem(SHIFT_PROGRESS_KEYS.state, JSON.stringify(optimistic));
      }
      window.dispatchEvent(new Event("uber-engine-shift-state-local"));
    } catch {
      // Best effort: the per-date store still holds the entry.
    }
    setPhase("mile-confirm");
  }, [milesValue, state, todayIso]);

  // Keep the local journal in step with whatever the published state reports, so
  // the week strip and mileage figures have continuity across sessions.
  useEffect(() => {
    if (!state) return;
    const dayKey = state.date || todayIso;
    if (state.todayEarnings > 0) rememberDay(dayKey, state.todayEarnings, state.activeMinutes);
    if (state.businessMilesToday > 0) {
      const store = readBusinessMiles();
      if ((store[dayKey] ?? 0) < state.businessMilesToday) {
        store[dayKey] = state.businessMilesToday;
        try {
          window.localStorage.setItem("map-engine-business-miles-v1", JSON.stringify(store));
        } catch {
          // Best effort.
        }
      }
    }
  }, [state, todayIso]);

  const businessMiles = useCallback(() => {
    const store = readBusinessMiles();
    const dayKey = state?.date || isoOf(Date.now());
    const publishedToday = state?.businessMilesToday ?? 0;
    const publishedWeek = state?.businessMilesWeek ?? 0;
    const today = publishedToday > 0 ? publishedToday : store[dayKey] ?? 0;
    const week = publishedWeek > 0 ? publishedWeek : weekMiles(store, Date.now());
    return { today, week };
  }, [state]);

  const miles = businessMiles();

  const weekStrip = useMemo(() => (state ? weekDays(readShiftDays(), Date.now()) : []), [state]);

  const dailyPct = state && state.dailyTarget > 0 ? state.todayEarnings / state.dailyTarget : 0;
  const weeklyPct = state && state.weeklyTarget > 0 ? state.weeklyEarnings / state.weeklyTarget : 0;

  const statusText = !state ? "No shift data" : state.hasActiveShift ? (state.paused ? "Paused" : "Shift live") : "Shift off";

  const updateTotalView = () => {
    if (state) setCounterValue(Math.round(state.todayEarnings));
    else setCounterValue(0);
    setPhase("edit");
  };

  const updateMilesView = () => {
    if (state) setMilesValue(Math.round(miles.today));
    else setMilesValue(0);
    setPhase("miles");
  };

  const dashboardControls = (
    <div className="shift-controls">
      {!state?.hasActiveShift ? (
        <>
          <button type="button" className="shift-control-btn" onClick={() => sendControl("start")}>START SHIFT</button>
          <button type="button" className="shift-control-btn update" onClick={updateTotalView}>UPDATE EARNINGS</button>
          <button type="button" className="shift-control-btn update" onClick={updateMilesView}>UPDATE MILEAGE</button>
        </>
      ) : (
        <>
          <button type="button" className="shift-control-btn pause" onClick={() => sendControl(state.paused ? "resume" : "pause")}>{state.paused ? "RESUME" : "PAUSE"}</button>
          <button type="button" className="shift-control-btn update" onClick={updateTotalView}>UPDATE EARNINGS</button>
          <button type="button" className="shift-control-btn update" onClick={updateMilesView}>UPDATE MILEAGE</button>
          <button type="button" className="shift-control-btn end" onClick={() => setEnding(true)}>END SHIFT</button>
        </>
      )}
    </div>
  );

  return (
    <div className="shift-scrim" role="presentation" onClick={onClose}>
      {phase === "dash" || phase === "week" ? (
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
              <h2>{phase === "week" ? "Week" : "Shift Dashboard"}</h2>
            </div>
            <div className="shift-head-meta">
              <span className="shift-control-status">
                <i className={`dot${!state ? " off" : state.hasActiveShift ? (state.paused ? " paused" : "") : " off"}`} aria-hidden="true" />
                {statusText}
              </span>
            </div>
          </header>

          <div className="shift-modal-body shift-modal-body-main">
            {state === null ? (
              <>
                <p className="shift-unavailable-eyebrow">NO SHIFT DATA</p>
                <p className="shift-unavailable-title">Shift data unavailable</p>
                <p className="shift-unavailable-note">Open the Uber Engine app once so it can publish today's shift, or sync today's running total below.</p>
              </>
            ) : phase === "week" ? (
              <div className="shift-week">
                <div className="shift-week-head">
                  <div className="shift-week-hero">
                    <span className="shift-target-label">WEEK</span>
                    <strong>{formatMoneyWhole(state.weeklyEarnings)}</strong>
                    <span>of {formatMoneyWhole(state.weeklyTarget)}</span>
                    <em className={weeklyPct > 1 ? "over" : ""}>{Math.round(weeklyPct * 100)}%</em>
                  </div>
                  <div className="shift-week-key">
                    <div className="shift-week-stat tall">
                      <span>Total hours</span>
                      <strong>{formatHoursMinutes(state.weeklyMinutes)}</strong>
                    </div>
                    <div className="shift-week-stat tall">
                      <span>Rate</span>
                      <strong>{state.hourlyRate > 0 ? `£${state.hourlyRate.toFixed(2)}/hr` : "—"}</strong>
                    </div>
                    <div className="shift-week-stat">
                      <span>Business mileage</span>
                      <strong>{Math.round(miles.week)} mi</strong>
                      <button type="button" className="shift-mile-inline" onClick={updateMilesView}>UPDATE</button>
                    </div>
                  </div>
                </div>
                <div className="shift-week-strip" aria-label="Daily earnings this week">
                  {weekStrip.map((day) => (
                    <div key={day.date} className={`shift-week-day${day.earnings <= 0 ? " empty" : ""}`}>
                      <span>{day.label}</span>
                      <strong>{day.earnings > 0 ? formatMoneyWhole(day.earnings) : "—"}</strong>
                    </div>
                  ))}
                </div>
                <button type="button" className="shift-week-back" onClick={() => setPhase("dash")}>BACK TO DASHBOARD</button>
              </div>
            ) : (
              // TESLA UI:
              // The previous analytical tile grid (Remaining, rides remaining,
              // worked hours, estimated time remaining, current rate, target
              // rate) is intentionally removed from the lean dashboard. The
              // closing-<DashboardBody/> logic below is the only active body.
              <div className="shift-dash">
                <div className="shift-targets">
                  <div className="shift-target-block">
                    <span className="shift-target-label">TODAY</span>
                    <Donut pct={dailyPct} earnedLabel={formatMoneyWhole(state.todayEarnings)} targetLabel={formatMoneyWhole(state.dailyTarget)} />
                  </div>
                  <div
                    className="shift-target-block tappable"
                    role="button"
                    tabIndex={0}
                    aria-label="Open the weekly breakdown"
                    onClick={() => setPhase("week")}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setPhase("week"); } }}
                  >
                    <span className="shift-target-label">WEEK</span>
                    <Donut pct={weeklyPct} earnedLabel={formatMoneyWhole(state.weeklyEarnings)} targetLabel={formatMoneyWhole(state.weeklyTarget)} />
                  </div>
                </div>
                <div className="shift-metrics">
                  <div className="shift-metric rate">
                    <span className="shift-metric-value">{state.hourlyRate > 0 ? `£${state.hourlyRate.toFixed(2)}` : "—"}<small>/hr</small></span>
                    <span className="shift-metric-label">CURRENT £ / HOUR</span>
                  </div>
                  <div className="shift-metric miles">
                    <div className="shift-mile-cols">
                      <div><strong>{Math.round(miles.today)}</strong><small> mi</small><em>TODAY</em></div>
                      <div><strong>{Math.round(miles.week)}</strong><small> mi</small><em>WEEK</em></div>
                    </div>
                    <span className="shift-metric-label">BUSINESS MILEAGE</span>
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
              dashboardControls
            )}
          </div>
          {controlNote && <p className="shift-end-note" role="status">Shift command sent to the Uber Engine app.</p>}
        </section>
      ) : phase === "edit" || phase === "confirm" ? (
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
      ) : phase === "miles" || phase === "mile-confirm" ? (
        <section
          className="shift-modal small"
          role="dialog"
          aria-modal="true"
          aria-label="Update business mileage"
          onClick={(event) => event.stopPropagation()}
        >
          <button ref={closeRef} type="button" className="shift-modal-close" onClick={onClose} aria-label="Close">×</button>
          {phase === "miles" ? (
            <div className="shift-update">
              <p className="shift-update-eyebrow">UPDATE BUSINESS MILEAGE</p>
              <h2>Today's business miles</h2>
              <div className="shift-update-total">
                <span>Today's total</span>
                <strong>{Math.round(milesValue)} <em className="shift-miles-unit">mi</em></strong>
              </div>
              <div className="shift-mile-steppers" aria-label="Today's mileage counter">
                <button type="button" onClick={() => adjustMiles(-10)} aria-label="Subtract 10 miles">−10</button>
                <button type="button" onClick={() => adjustMiles(-1)} aria-label="Subtract 1 mile">−1</button>
                <button type="button" onClick={() => adjustMiles(1)} aria-label="Add 1 mile">+1</button>
                <button type="button" onClick={() => adjustMiles(10)} aria-label="Add 10 miles">+10</button>
              </div>
              <div className="shift-mile-context"><span>This week</span><strong>{Math.round(miles.week)} mi</strong></div>
              <div className="shift-update-actions">
                <button type="button" className="shift-counter-save" onClick={saveMiles}>✓ SAVE MILEAGE</button>
                <button type="button" className="shift-counter-cancel" onClick={() => setPhase("dash")}>CANCEL</button>
              </div>
            </div>
          ) : (
            <div className="shift-confirm">
              <span className="shift-confirm-tick" aria-hidden="true">✓</span>
              <p className="shift-update-eyebrow">MILES RECORDED</p>
              <strong className="shift-confirm-total">{Math.round(milesValue)} mi</strong>
              <span className="shift-confirm-note">Business miles for today</span>
              <div className="shift-confirm-actions">
                <button type="button" className="shift-counter-save" onClick={() => setPhase("dash")}>BACK TO DASHBOARD</button>
                <button type="button" className="shift-counter-cancel" onClick={() => setPhase("miles")}>ADJUST MILES AGAIN</button>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}