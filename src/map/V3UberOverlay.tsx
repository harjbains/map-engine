import { useEffect, useState } from "react";
import { TeslaUberDashboard, AnimatedProgressBar } from "../dashboard/Dashboard.js";
import { DailyEarningsPanel } from "../dashboard/DailyEarningsPanel.js";
import { MileagePanel } from "../dashboard/MileagePanel.js";
import { WeeklyPlanPanel } from "../dashboard/WeeklyPlanPanel.js";
import { ShiftHistoryPanel } from "../dashboard/ShiftHistoryPanel.js";

import { gbpFromPence } from "../uber/money.js";
import { uberProgressCycle } from "../uber/progress.js";
import type { UberDashboard, WeeklySummary, WorkWeight, UberShift } from "../uber/types.js";
import type { EarningsTransition, EarningsMilestone } from "../uber/milestones.js";
import "./v3-uber-overlay.css";

export function V3UberOverlay({ dashboard, preview, onSaveTodayEarnings, onSaveMileage, onSavePlan, onLoadHistory, onChangeDate, onSignOut, onStartShift, onEndShift, transition, darkMode, onToggleDarkMode }: {
  dashboard: UberDashboard; preview: boolean;
  onSaveTodayEarnings: (previewPence: number) => Promise<UberDashboard>;
  onSaveMileage: (milesTenths: number) => Promise<UberDashboard>;
  onSavePlan: (targetPence: number, weights: Array<WorkWeight | null>) => Promise<UberDashboard>;
  onLoadHistory: () => Promise<WeeklySummary[]>;
  onChangeDate?: (date: string | null) => void;
  onSignOut?: () => Promise<void>;
  onStartShift: (startEarnings: number) => Promise<UberDashboard>;
  onEndShift: (shiftId: string, endEarnings: number) => Promise<UberDashboard>;
  transition: EarningsTransition | null;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}) {
  const [modal, setModal] = useState<"closed" | "dashboard" | "editor" | "mileage" | "plan" | "history" | "changelog" | "shifts">("closed");
  const [returnTo, setReturnTo] = useState<"closed" | "history" | "dashboard">("closed");
  const [flash, setFlash] = useState(false);
  const [activeTransition, setActiveTransition] = useState<EarningsTransition | null>(null);

  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const [showCompletion, setShowCompletion] = useState(false);
  useEffect(() => {
    const todayStr = dashboard.today;
    const h = currentTime.getHours();
    if (h >= 11 && h < 15) {
      if (!localStorage.getItem(`morning_commitment_${todayStr}`)) {
        setShowCompletion(true);
        localStorage.setItem(`morning_commitment_${todayStr}`, "true");
      }
    } else {
      setShowCompletion(false);
    }
  }, [currentTime, dashboard.today]);

  useEffect(() => {
    if (showCompletion) {
      const timer = setTimeout(() => setShowCompletion(false), 3 * 60 * 1000);
      return () => clearTimeout(timer);
    }
  }, [showCompletion]);

  useEffect(() => {
    if (!transition) return;
    if (transition.cycleCrossed) setFlash(true);
    setActiveTransition(transition);
    const cycleTimer = window.setTimeout(() => setFlash(false), 1_100);
    return () => { window.clearTimeout(cycleTimer); };
  }, [transition]);
    const activeShift = dashboard.shifts?.find(s => s.status === 'active');
  const [showStartPrompt, setShowStartPrompt] = useState(false);

  useEffect(() => {
    if (!activeShift) {
      const timer = window.setTimeout(() => setShowStartPrompt(true), 5 * 60 * 1000);
      return () => window.clearTimeout(timer);
    } else {
      setShowStartPrompt(false);
    }
  }, [activeShift]);

  const [liveSeconds, setLiveSeconds] = useState(0);
  useEffect(() => {
    if (activeShift && activeShift.startTimestamp) {
      const startMs = new Date(activeShift.startTimestamp).getTime();
      setLiveSeconds(Math.floor((Date.now() - startMs) / 1000));
      const timer = window.setInterval(() => {
        setLiveSeconds(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);
      return () => window.clearInterval(timer);
    } else {
      setLiveSeconds(0);
    }
  }, [activeShift]);

  const shiftEarnings = activeShift ? dashboard.todayEarningsPence - activeShift.startEarningsPence : 0;
  const shiftPph = liveSeconds > 0 ? Math.floor(shiftEarnings / (liveSeconds / 3600)) : 0;
  const pphPercent = Math.min(100, Math.floor((shiftPph / 3000) * 100)); // £30/hr is 100%
  const pphColor = shiftPph >= 2000 ? "#10b981" : (shiftPph >= 1500 ? "#eab308" : "#ef4444");

  const hrs = Math.floor(liveSeconds / 3600);
  const mins = Math.floor((liveSeconds % 3600) / 60);

  const dailyTargetPence = dashboard.todayTargetPence || 0;
  const isTargetUnlocked = dailyTargetPence > 0 && dashboard.todayEarningsPence >= dailyTargetPence;
  
  const blockIndex = Math.floor(dashboard.todayEarningsPence / 2500);
  const blockTargetPence = (blockIndex + 1) * 2500;
  
  const blockProgressPence = dashboard.todayEarningsPence % 2500;
  const percent = (blockProgressPence / 2500) * 100;
  
  const remainingToBlock = blockTargetPence - dashboard.todayEarningsPence;
  const remainingToDaily = Math.max(0, dailyTargetPence - dashboard.todayEarningsPence);
  const isNearlyReached = !isTargetUnlocked && remainingToDaily > 0 && remainingToDaily <= 1000;
  
  const barColor = isTargetUnlocked ? "#eab308" : "#3b82f6";
  const avgTripPence = dashboard.todayTrips > 0 ? (dashboard.todayEarningsPence / dashboard.todayTrips) : 450;

  let topLeftText = isTargetUnlocked ? "BONUS TIME" : (isNearlyReached ? "ALMOST THERE" : "ON TRACK");
  
  let topRightText = `${Math.floor(remainingToBlock / 100)} TO NEXT BLOCK`;

  const hour = currentTime.getHours();
  if (showCompletion) {
    topLeftText = "MORNING COMMITMENT ACHIEVED ✓";
    topRightText = "11:00 REACHED";
  } else if (hour === 9) {
    const hash = Math.floor(dashboard.todayEarningsPence / 500);
    const msgs = [
      "STAY IN THE GAME",
      "YOUR MORNING ISN'T OVER YET",
      "KEEP YOUR OPTIONS OPEN UNTIL 11",
      "ANOTHER RIDE, ANOTHER STEP FORWARD",
      "KEEP BUILDING YOUR TESLA FUND"
    ];
    topLeftText = msgs[hash % msgs.length];
    topRightText = "11:00 FINISH";
  } else if (hour === 10) {
    const hash = Math.floor(dashboard.todayEarningsPence / 500);
    const msgs = [
      "FINAL HOUR",
      "YOUR 11:00 FINISH IS GETTING CLOSER",
      "ONE MORE RIDE COULD BUILD YOUR BONUS",
      "KEEP YOUR MORNING MOMENTUM",
      "EVERY EXTRA £5 BUILDS YOUR TESLA FUND"
    ];
    topLeftText = msgs[hash % msgs.length];
    topRightText = "11:00 FINISH";
  }
  const squaresLeft = Math.ceil(remainingToBlock / 500);
  const visualStars = Math.min(squaresLeft, 5);

    const primaryText = darkMode ? "#ffffff" : "#197a48";
  const trackBg = darkMode ? "#334155" : "#e0f2fe";
  const trackBorder = darkMode ? "#000" : "#bae6fd";
  const starBoxBg = darkMode ? "#1e293b" : "#ffffff";
  const starBoxBorder = darkMode ? "#334155" : "#bae6fd";
  const goldText = darkMode ? "#eab308" : "#d97706";

  return <>
    
      {showStartPrompt && !activeShift && modal === "closed" && (
        <div style={{ position: 'absolute', inset: 16, background: darkMode ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)', borderRadius: '16px', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', border: `1px solid ${trackBorder}`, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: primaryText, textAlign: 'center' }}>ARE YOU WORKING?<br/><span style={{ color: goldText, fontSize: '16px' }}>SHIFT STARTED?</span></div>
          <button onClick={() => { setShowStartPrompt(false); onStartShift(dashboard.todayEarningsPence); }} style={{ padding: '12px 24px', background: '#3b82f6', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '16px', fontWeight: 800, width: '80%' }}>START SHIFT</button>
          <button onClick={() => setShowStartPrompt(false)} style={{ padding: '12px 24px', background: 'transparent', color: darkMode ? '#94a3b8' : '#64748b', borderRadius: '8px', border: `1px solid ${trackBorder}`, fontSize: '14px', fontWeight: 700, width: '80%' }}>NO - NOT WORKING</button>
        </div>
      )}
    <footer className="uber-session-footer" style={{ height: 'auto', padding: '12px 16px', flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="session-progress" style={{ borderRight: 'none', padding: 0, flexDirection: 'column', height: 'auto', gap: '8px', background: 'transparent', cursor: 'default' }}>
        
        {/* TOP ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', width: '100%', fontSize: '11px', fontWeight: 800, color: goldText, letterSpacing: '0.5px' }}>
            <span style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{topLeftText}</span>
            {dailyTargetPence > 0 && !isTargetUnlocked ? (
              <span style={{ textAlign: 'center', color: darkMode ? '#64748b' : '#94a3b8', fontSize: '18px', fontWeight: 900 }}>
                {Math.floor(dailyTargetPence / 100)}
              </span>
            ) : <span />}
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{topRightText}</span>
          </div>

        {/* PROGRESS BAR ROW */}
        <div className="session-progress-track" style={{ height: '12px', borderRadius: '6px', border: `1px solid ${trackBorder}`, width: '100%', background: trackBg, flex: 'none', overflow: 'hidden' }}>
          <div className="session-progress-fill" style={{ height: '100%', width: `${percent}%`, background: barColor, borderRadius: '6px', transition: 'width 0.3s ease', padding: 0 }} />
        </div>

        
        {/* PPH ROW */}
        {activeShift && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: darkMode ? '#94a3b8' : '#64748b', width: '40px' }}>£/HR</span>
            <div style={{ height: '8px', borderRadius: '4px', border: `1px solid ${trackBorder}`, flex: 1, background: trackBg, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pphPercent}%`, background: pphColor, transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 800, color: pphColor, width: '30px', textAlign: 'right' }}>£{Math.floor(shiftPph / 100)}</span>
          </div>
        )}

        {/* BOTTOM ROW */}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '2px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569' }}>
              {Math.floor(dashboard.todayEarningsPence / 100)}
            </span>
          
          {squaresLeft > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: visualStars }).map((_, i) => (
                  <div key={i} style={{ width: '22px', height: '22px', borderRadius: '6px', background: starBoxBg, border: `1px solid ${starBoxBorder}`, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <svg viewBox="0 0 24 24" fill={goldText} width="12" height="12"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </div>
                ))}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: goldText }}>
                {squaresLeft} left
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>TARGET MET</span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 30, position: 'relative' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569' }}>
                {Math.floor(blockTargetPence / 100)}
              </span>
              {!activeShift ? (
                <button onClick={() => onStartShift(dashboard.todayEarningsPence)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>START SHIFT</button>
              ) : (
                <button onClick={() => onEndShift(activeShift.id, dashboard.todayEarningsPence)} style={{ background: 'transparent', color: darkMode ? '#ef4444' : '#dc2626', border: `1px solid ${darkMode ? '#ef4444' : '#dc2626'}`, padding: '5px 11px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>END SHIFT</button>
              )}
            </div>
        </div>

      </div>
        
        {/* Clickable Zones & Shift Controls */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 10, borderRadius: '12px', overflow: 'hidden' }}>
          <button type="button" onClick={() => { setReturnTo("closed"); setModal("dashboard"); }} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }} />
          <button type="button" onClick={() => { setReturnTo("closed"); setModal("editor"); }} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }} />
        </div>
        
        </footer>
        {modal !== "closed" && <div className="uber-modal-backdrop" role="presentation" onMouseDown={() => setModal("closed")}>
      <section className="uber-modal" role="dialog" aria-modal="true" aria-label="Uber earnings dashboard" onMouseDown={(event) => event.stopPropagation()}>
        {modal === "dashboard" && <TeslaUberDashboard dashboard={dashboard} preview={preview} darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} onClose={() => {setModal("closed"); onChangeDate?.(null);}} onUpdate={() => {setReturnTo("dashboard"); setModal("editor");}} onMileage={() => {setReturnTo("dashboard"); setModal("mileage");}} onPlan={() => setModal("plan")} onShifts={() => setModal("shifts")} onUpdateHistoricalDay={(date) => {onChangeDate?.(date);}} {...(onChangeDate ? {onChangeDate} : {})} />}
        {modal === "editor" && <DailyEarningsPanel darkMode={darkMode} key={dashboard.today} dashboard={dashboard} onCancel={() => setModal(returnTo === "history" ? "history" : (returnTo === "closed" ? "closed" : "dashboard"))} onSave={async (previewPence) => { await onSaveTodayEarnings(previewPence); setModal("closed"); if (returnTo === "closed") onChangeDate?.(null); }} />}
        {modal === "mileage" && <MileagePanel darkMode={darkMode} key={dashboard.today} dashboard={dashboard} onCancel={() => setModal(returnTo === "history" ? "history" : (returnTo === "closed" ? "closed" : "dashboard"))} onSave={async (miles) => { await onSaveMileage(miles); setModal("closed"); if (returnTo === "closed") onChangeDate?.(null); }} />}
        {modal === "shifts" && <ShiftHistoryPanel darkMode={darkMode} dashboard={dashboard} onClose={() => setModal("dashboard")} />}
        {modal === "plan" && <WeeklyPlanPanel dashboard={dashboard} onCancel={() => setModal("dashboard")} onSave={async (targetPence, weights) => { await onSavePlan(targetPence, weights); setModal("closed"); onChangeDate?.(null); }} />}
        
      </section>
    </div>}
  </>;
}
