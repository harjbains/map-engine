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

  const remainingPence = Math.max(0, currentMaxTarget - dashboard.todayEarningsPence);
  const isNearlyReached = currentMaxTarget > 0 && remainingPence <= 1000;
  const barColor = targetUnlocked ? "#eab308" : "#3b82f6";
  const percent = currentMaxTarget ? Math.min(100, Math.floor((dashboard.todayEarningsPence / currentMaxTarget) * 100)) : 0;
  
  const avgTripPence = dashboard.todayTrips > 0 ? (dashboard.todayEarningsPence / dashboard.todayTrips) : 450;
  const tripsLeft = remainingPence === 0 ? 0 : Math.max(1, Math.ceil(remainingPence / avgTripPence));
  const visualStars = Math.min(tripsLeft, 7);

  return <>
    <footer className="uber-session-footer" style={{ height: 'auto', padding: '12px 16px', flexDirection: 'column', alignItems: 'stretch' }}>
      <button type="button" className="session-progress" onClick={() => setModal("editor")} aria-label="Open Update Earnings screen" style={{ borderRight: 'none', padding: 0, flexDirection: 'column', height: 'auto', gap: '8px', background: 'transparent' }}>
        
        {/* TOP ROW */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '11px', fontWeight: 800, color: '#eab308', letterSpacing: '0.5px' }}>
          <span>{targetUnlocked ? "BONUS TIME" : (isNearlyReached ? "ALMOST THERE" : "ON TRACK")}</span>
          <span>{remainingPence > 0 ? `${Math.floor(remainingPence / 100)} TO NEXT MILESTONE` : "MILESTONE REACHED"}</span>
        </div>

        {/* PROGRESS BAR ROW */}
        <div className="session-progress-track" style={{ height: '12px', borderRadius: '6px', border: '1px solid #000', width: '100%', background: '#334155', flex: 'none', overflow: 'hidden' }}>
          <div className="session-progress-fill" style={{ height: '100%', width: `${percent}%`, background: barColor, borderRadius: '6px', transition: 'width 0.3s ease', padding: 0 }} />
        </div>

        {/* BOTTOM ROW */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '2px' }}>
          <span style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
            {Math.floor(dashboard.todayEarningsPence / 100)}
          </span>
          
          {tripsLeft > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: visualStars }).map((_, i) => (
                  <div key={i} style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#1e293b', border: '1px solid #334155', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <svg viewBox="0 0 24 24" fill="#eab308" width="12" height="12"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </div>
                ))}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#eab308' }}>
                {tripsLeft} left
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>TARGET MET</span>
          )}

          <span style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
            {Math.floor(currentMaxTarget / 100)}
          </span>
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
