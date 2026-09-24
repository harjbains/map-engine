import { useEffect, useState } from "react";
import { TeslaUberDashboard, AnimatedProgressBar } from "../dashboard/Dashboard.js";
import { DailyEarningsPanel } from "../dashboard/DailyEarningsPanel.js";
import { MileagePanel } from "../dashboard/MileagePanel.js";
import { WeeklyPlanPanel } from "../dashboard/WeeklyPlanPanel.js";

import { gbpFromPence } from "../uber/money.js";
import { uberProgressCycle } from "../uber/progress.js";
import type { UberDashboard, WeeklySummary, WorkWeight } from "../uber/types.js";
import type { EarningsTransition, EarningsMilestone } from "../uber/milestones.js";
import { MilestoneCelebration } from "./MilestoneCelebration.js";
import "./v3-uber-overlay.css";

export function V3UberOverlay({ dashboard, preview, onSaveTodayEarnings, onSaveMileage, onSavePlan, onLoadHistory, onChangeDate, onSignOut, onStartSession, onPauseSession, onResumeSession, onEndSession, transition, darkMode, onToggleDarkMode }: {
  dashboard: UberDashboard; preview: boolean;
  onSaveTodayEarnings: (previewPence: number) => Promise<UberDashboard>;
  onSaveMileage: (milesTenths: number) => Promise<UberDashboard>;
  onSavePlan: (weights: Array<WorkWeight | null>) => Promise<UberDashboard>;
  onLoadHistory: () => Promise<WeeklySummary[]>;
  onChangeDate?: (date: string | null) => void;
  onSignOut?: () => Promise<void>;
  onStartSession: () => Promise<UberDashboard>;
  onPauseSession: () => Promise<UberDashboard>;
  onResumeSession: () => Promise<UberDashboard>;
  onEndSession: () => Promise<UberDashboard>;
  transition: EarningsTransition | null;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}) {
  const [modal, setModal] = useState<"closed" | "dashboard" | "editor" | "mileage" | "plan" | "history" | "changelog">("closed");
  const [returnTo, setReturnTo] = useState<"closed" | "history" | "dashboard">("closed");
  const [flash, setFlash] = useState(false);
  const [activeTransition, setActiveTransition] = useState<EarningsTransition | null>(null);

  useEffect(() => {
    if (!transition) return;
    if (transition.cycleCrossed) setFlash(true);
    setActiveTransition(transition);
    const cycleTimer = window.setTimeout(() => setFlash(false), 1_100);
    return () => { window.clearTimeout(cycleTimer); };
  }, [transition]);
  // Derived session info
  const sessionActive = dashboard.session?.status === "active";
  const sessionPaused = dashboard.session?.status === "paused";
  const sessionCompleted = dashboard.session?.status === "completed";
  
  // Calculate display seconds live if active
  const [liveSeconds, setLiveSeconds] = useState(dashboard.session?.activeSeconds ?? 0);
  
  useEffect(() => {
    if (!dashboard.session) return;
    setLiveSeconds(dashboard.session.activeSeconds);
    if (dashboard.session.status === "active") {
      const timer = window.setInterval(() => {
        const elapsed = Math.floor((new Date().getTime() - new Date(dashboard.session!.lastResumedAt).getTime()) / 1000);
        setLiveSeconds(dashboard.session!.activeSeconds + elapsed);
      }, 1000);
      return () => window.clearInterval(timer);
    }
  }, [dashboard.session]);

  const hrs = Math.floor(liveSeconds / 3600);
  const mins = Math.floor((liveSeconds % 3600) / 60);

  const forecastBand = dashboard.forecastBand ?? "grey";
  const percent = dashboard.todayTargetPence ? Math.min(100, Math.floor((dashboard.todayEarningsPence / dashboard.todayTargetPence) * 100)) : 0;

  return <>
      <footer className="uber-session-footer">
        <button type="button" className={`session-progress session-progress-${forecastBand}`} onClick={() => setModal("editor")} aria-label="Open Update Earnings screen">
          
          <div className="session-progress-track">
            <div className="session-progress-fill" style={{ width: `${percent}%` }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', zIndex: 2, pointerEvents: 'none' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: percent > 10 ? '#000' : '#fff', textShadow: percent > 10 ? 'none' : '0 1px 3px rgba(0,0,0,0.8)', transition: 'color 0.3s' }}>
                  {(dashboard.todayEarningsPence / 100).toFixed(2).replace('.00', '')}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: percent > 90 ? '#000' : '#8ba2b3', textShadow: percent > 90 ? 'none' : '0 1px 3px rgba(0,0,0,0.8)', transition: 'color 0.3s' }}>
                  {dashboard.todayTargetPence ? (dashboard.todayTargetPence / 100).toFixed(2).replace('.00', '') : '--'}
                </span>
              </div>
          </div>
        </button>

        <div className="session-controls">
          {(!dashboard.session || dashboard.session.status === "completed") && (
            <button type="button" className="btn-session btn-start" onClick={onStartSession} aria-label="Start Session">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z" /></svg>
              Start
            </button>
          )}
          {sessionActive && (
            <button type="button" className="btn-session btn-pause" onClick={onPauseSession} aria-label="Pause Session">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              Pause
            </button>
          )}
          {sessionPaused && (
            <button type="button" className="btn-session btn-resume" onClick={onResumeSession} aria-label="Resume Session">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z" /></svg>
              Resume
            </button>
          )}
          <button type="button" className="btn-session btn-stop" onClick={onEndSession} disabled={!dashboard.session || sessionCompleted} aria-label="Stop Session">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M6 6h12v12H6z" /></svg>
            Stop
          </button>
        </div>

        <div className="session-time">
          <div className="time-value">{hrs}h {mins}m</div>
          <div className="time-label">Session</div>
        </div>
      </footer>
    <MilestoneCelebration transition={activeTransition} onComplete={() => setActiveTransition(null)} />
    {modal !== "closed" && <div className="uber-modal-backdrop" role="presentation" onMouseDown={() => setModal("closed")}>
      <section className="uber-modal" role="dialog" aria-modal="true" aria-label="Uber earnings dashboard" onMouseDown={(event) => event.stopPropagation()}>
        {modal === "dashboard" && <TeslaUberDashboard dashboard={dashboard} preview={preview} darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} onClose={() => {setModal("closed"); onChangeDate?.(null);}} onUpdate={() => {setReturnTo("dashboard"); setModal("editor");}} onMileage={() => {setReturnTo("dashboard"); setModal("mileage");}} onPlan={() => setModal("plan")} onUpdateHistoricalDay={(date) => {onChangeDate?.(date);}} {...(onChangeDate ? {onChangeDate} : {})} />}
        {modal === "editor" && <DailyEarningsPanel darkMode={darkMode} key={dashboard.today} dashboard={dashboard} onCancel={() => setModal(returnTo === "history" ? "history" : "dashboard")} onSave={async (previewPence) => { await onSaveTodayEarnings(previewPence); setModal("closed"); if (returnTo === "closed") onChangeDate?.(null); }} />}
        {modal === "mileage" && <MileagePanel darkMode={darkMode} key={dashboard.today} dashboard={dashboard} onCancel={() => setModal(returnTo === "history" ? "history" : "dashboard")} onSave={async (miles) => { await onSaveMileage(miles); setModal("closed"); if (returnTo === "closed") onChangeDate?.(null); }} />}
        {modal === "plan" && <WeeklyPlanPanel dashboard={dashboard} onCancel={() => setModal("dashboard")} onSave={async (weights) => { await onSavePlan(weights); setModal("closed"); onChangeDate?.(null); }} />}
        
      </section>
    </div>}
  </>;
}
