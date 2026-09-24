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

  let currentMaxTarget = dashboard.todayTargetPence || 0;
  let targetUnlocked = false;
  if (currentMaxTarget > 0) {
    while (dashboard.todayEarningsPence >= currentMaxTarget) {
      currentMaxTarget += 2500;
      targetUnlocked = true;
    }
  }

  const isNearlyReached = currentMaxTarget > 0 && (currentMaxTarget - dashboard.todayEarningsPence) <= 1000;
  const barColor = targetUnlocked ? "#eab308" : "#3b82f6";
  const percent = currentMaxTarget ? Math.min(100, Math.floor((dashboard.todayEarningsPence / currentMaxTarget) * 100)) : 0;

  return <>
    <footer className="uber-session-footer">
      <button type="button" className="session-progress" onClick={() => setModal("editor")} aria-label="Open Update Earnings screen" style={{ borderRight: 'none', padding: 0 }}>
        <div className="session-progress-track" style={{ height: '38px', borderRadius: '8px', border: '1px solid #2a3a46' }}>
          <div className="session-progress-fill" style={{ width: `${percent}%`, background: barColor }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', zIndex: 2, pointerEvents: 'none' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: percent > 10 ? '#000' : '#fff', textShadow: percent > 10 ? 'none' : '0 1px 3px rgba(0,0,0,0.8)', transition: 'color 0.3s' }}>
                {(dashboard.todayEarningsPence / 100).toFixed(2).replace('.00', '')}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: percent > 75 ? '#000' : '#8ba2b3', textShadow: percent > 75 ? 'none' : '0 1px 3px rgba(0,0,0,0.8)', transition: 'color 0.3s' }}>
                {isNearlyReached ? "Target nearly reached!" : (currentMaxTarget / 100).toFixed(2).replace('.00', '')}
              </span>
            </div>
        </div>
      </button>
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
