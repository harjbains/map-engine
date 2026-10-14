import { useEffect, useState } from "react";
import { TeslaUberDashboard } from "../dashboard/Dashboard.js";
import { DailyEarningsPanel } from "../dashboard/DailyEarningsPanel.js";
import { MileagePanel } from "../dashboard/MileagePanel.js";
import { WeeklyPlanPanel } from "../dashboard/WeeklyPlanPanel.js";
import { ShiftHistoryPanel } from "../dashboard/ShiftHistoryPanel.js";

import type { UberDashboard, WeeklySummary } from "../uber/types.js";
import type { EarningsTransition } from "../uber/milestones.js";
import "./v3-uber-overlay.css";

export function V3UberOverlay({ dashboard, preview, onSaveTodayEarnings, onSaveMileage, onSavePlan, onLoadHistory, onChangeDate, onSignOut, onStartShift, onEndShift, onUpdateShift, onDeleteShift, transition, darkMode, onToggleDarkMode, openTrigger }: {
  dashboard: UberDashboard; preview: boolean;
  onSaveTodayEarnings: (previewPence: number) => Promise<UberDashboard>;
  onSaveMileage: (milesTenths: number) => Promise<UberDashboard>;
  onSavePlan: (amTargets: number[], pmTargets: number[]) => Promise<UberDashboard>;
  onLoadHistory: () => Promise<WeeklySummary[]>;
  onChangeDate?: (date: string | null) => void;
  onSignOut?: () => Promise<void>;
  onStartShift: (shiftType: 'am' | 'pm', startEarnings: number) => Promise<UberDashboard>;
  onEndShift: (shiftId: string, endEarnings: number) => Promise<UberDashboard>;
  onUpdateShift?: (shiftId: string, updates: any) => Promise<UberDashboard>;
  onDeleteShift?: (shiftId: string) => Promise<UberDashboard>;
  transition: EarningsTransition | null;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  openTrigger?: number;
}) {
  const [modal, setModal] = useState<"closed" | "dashboard" | "editor" | "mileage" | "plan" | "history" | "changelog" | "shifts">("closed");
  const [returnTo, setReturnTo] = useState<"closed" | "history" | "dashboard">("closed");

  useEffect(() => {
    if (openTrigger && openTrigger > 0) {
      setModal("dashboard");
    }
  }, [openTrigger]);

  return (
    <>
      {modal !== "closed" && <div className="uber-modal-backdrop" role="presentation" onMouseDown={() => setModal("closed")}>
        <section className="uber-modal" role="dialog" aria-modal="true" aria-label="Uber earnings dashboard" onMouseDown={(event) => event.stopPropagation()}>
          {modal === "dashboard" && <TeslaUberDashboard dashboard={dashboard} preview={preview} darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} onClose={() => {setModal("closed"); onChangeDate?.(null);}} onUpdate={() => {setReturnTo("dashboard"); setModal("editor");}} onMileage={() => {setReturnTo("dashboard"); setModal("mileage");}} onPlan={() => setModal("plan")} onShifts={() => setModal("shifts")} onUpdateHistoricalDay={(date) => {onChangeDate?.(date);}} {...(onChangeDate ? {onChangeDate} : {})} />}
          {modal === "editor" && <DailyEarningsPanel 
            darkMode={darkMode} 
            key={dashboard.today} 
            dashboard={dashboard} 
            onCancel={() => setModal(returnTo === "history" ? "history" : (returnTo === "closed" ? "closed" : "dashboard"))} 
            onSave={async (shiftType, shiftVal, optionalOtherVal) => { 
              let updatedDash = dashboard;

              const otherShiftType: 'am' | 'pm' = shiftType === 'pm' ? 'am' : 'pm';
              if (optionalOtherVal !== undefined) {
                const existingOther = updatedDash.shifts.find(s => s.shiftType === otherShiftType && s.date === updatedDash.today);
                if (existingOther) {
                  if (existingOther.status === 'active') {
                    updatedDash = await onEndShift(existingOther.id, optionalOtherVal);
                  } else if (onUpdateShift) {
                    updatedDash = await onUpdateShift(existingOther.id, { endEarningsPence: optionalOtherVal, startEarningsPence: 0 });
                  }
                } else if (optionalOtherVal > 0) {
                  const afterStart = await onStartShift(otherShiftType, 0);
                  const newShift = afterStart.shifts.find(s => s.shiftType === otherShiftType && s.date === afterStart.today && s.status === 'active');
                  if (newShift) {
                    updatedDash = await onEndShift(newShift.id, optionalOtherVal);
                  } else {
                    updatedDash = afterStart;
                  }
                }
              }

              const existingShift = updatedDash.shifts.find(s => s.shiftType === shiftType && s.date === updatedDash.today);
              if (existingShift) {
                if (existingShift.status === 'active') {
                  updatedDash = await onEndShift(existingShift.id, shiftVal);
                } else if (onUpdateShift) {
                  updatedDash = await onUpdateShift(existingShift.id, { endEarningsPence: shiftVal, startEarningsPence: 0 });
                }
              } else {
                const afterStart = await onStartShift(shiftType, 0);
                const newShift = afterStart.shifts.find(s => s.shiftType === shiftType && s.date === afterStart.today && s.status === 'active');
                if (newShift) {
                  updatedDash = await onEndShift(newShift.id, shiftVal);
                } else {
                  updatedDash = afterStart;
                }
              }
              
              const amShift = updatedDash.shifts.find(s => s.shiftType === 'am' && s.date === updatedDash.today);
              const pmShift = updatedDash.shifts.find(s => s.shiftType === 'pm' && s.date === updatedDash.today);
              
              const total = 
                ((amShift?.endEarningsPence ?? 0) - (amShift?.startEarningsPence ?? 0)) + 
                ((pmShift?.endEarningsPence ?? 0) - (pmShift?.startEarningsPence ?? 0));

              await onSaveTodayEarnings(total);
              setModal("closed"); 
              if (returnTo === "closed") onChangeDate?.(null); 
            }} 
          />}
          {modal === "mileage" && <MileagePanel darkMode={darkMode} key={dashboard.today} dashboard={dashboard} onCancel={() => setModal(returnTo === "history" ? "history" : (returnTo === "closed" ? "closed" : "dashboard"))} onSave={async (miles) => { await onSaveMileage(miles); setModal("closed"); if (returnTo === "closed") onChangeDate?.(null); }} />}
          {modal === "shifts" && <ShiftHistoryPanel darkMode={darkMode} dashboard={dashboard} onUpdateShift={onUpdateShift} onDeleteShift={onDeleteShift} onClose={() => setModal("dashboard")} />}
          {modal === "plan" && <WeeklyPlanPanel dashboard={dashboard} onCancel={() => setModal("dashboard")} onSave={async (amTargets, pmTargets) => { await onSavePlan(amTargets, pmTargets); setModal("closed"); onChangeDate?.(null); }} />}
        </section>
      </div>}
    </>
  );
}
