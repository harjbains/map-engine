import { useState } from "react";
import type { UberDashboard } from "../uber/types.js";
import { gbpFromPence } from "../uber/money.js";
import "./daily-earnings.css";

const longDate = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(`${date}T12:00:00Z`));
const isoWeek = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export function DailyEarningsPanel({ 
  dashboard, 
  onCancel, 
  onSave, 
  darkMode 
}: { 
  dashboard: UberDashboard; 
  onCancel: () => void; 
  onSave: (shiftType: 'am' | 'pm', previewPence: number, optionalOtherVal?: number) => Promise<void>; 
  darkMode?: boolean 
}) {
  const todayPlan = dashboard.days.find(d => d.date === dashboard.today);
  const amTarget = todayPlan?.amTargetPence ?? 0;
  const pmTarget = todayPlan?.pmTargetPence ?? 0;
  
  const amShift = dashboard.shifts.find(s => s.shiftType === 'am' && s.date === dashboard.today);
  const pmShift = dashboard.shifts.find(s => s.shiftType === 'pm' && s.date === dashboard.today);
  
  const amInitial = Math.max(0, (amShift?.endEarningsPence ?? 0) - (amShift?.startEarningsPence ?? 0));
  const pmInitial = Math.max(0, (pmShift?.endEarningsPence ?? 0) - (pmShift?.startEarningsPence ?? 0));

  // Default to AM, unless AM is completed and PM is not, or PM is already active
  const defaultShift = (amInitial > 0 && pmInitial === 0) ? 'pm' : (pmInitial > 0 ? 'pm' : 'am');

  const [shiftType, setShiftType] = useState<'am' | 'pm'>(defaultShift);
  const [amVal, setAmVal] = useState(amInitial);
  
  // Current total on the Uber app: starts at (AM earnings + PM earnings)
  const [pmCurrentTotal, setPmCurrentTotal] = useState(amInitial + pmInitial);

  // Evening shift total is automatically calculated: Current Total - Morning Shift
  const pmEveVal = Math.max(0, pmCurrentTotal - amVal);

  const add = (amountPence: number) => {
    if (shiftType === 'am') {
      setAmVal(v => {
        const next = Math.max(0, v + amountPence);
        setPmCurrentTotal(tot => Math.max(next, tot + (next - v)));
        return next;
      });
    } else {
      setPmCurrentTotal(v => Math.max(amVal, v + amountPence));
    }
  };

  const handleAmInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    if (!isNaN(num) && num >= 0) {
      const next = Math.round(num * 100);
      setAmVal(next);
      setPmCurrentTotal(tot => Math.max(next, tot + (next - amVal)));
    } else if (e.target.value === '') {
      setAmVal(0);
    }
  };

  const handlePmCurrentTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    if (!isNaN(num) && num >= 0) {
      setPmCurrentTotal(Math.round(num * 100));
    } else if (e.target.value === '') {
      setPmCurrentTotal(amVal);
    }
  };

  const handlePmEveValChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    if (!isNaN(num) && num >= 0) {
      setPmCurrentTotal(amVal + Math.round(num * 100));
    } else if (e.target.value === '') {
      setPmCurrentTotal(amVal);
    }
  };

  const currentVal = shiftType === 'am' ? amVal : pmEveVal;
  const target = shiftType === 'am' ? amTarget : pmTarget;
  const diff = currentVal - target;

  return (
    <div className={`v2-earnings-modal ${darkMode ? "dark" : ""}`}>
      <header className="v2-earnings-header">
        <div className="v2-brand">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2L2 22h20L12 2z"/></svg>
          MAP-ENGINE V3
        </div>
        <button className="v2-close" onClick={onCancel} aria-label="Close">✕</button>
      </header>

      <div className="v2-title-row">
        <div className="v2-title-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#2b75d6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="#2b75d6"/></svg>
            <h2>Update Earnings</h2>
          </div>
          <div className="v2-date">{longDate(dashboard.today)}</div>
        </div>
        <div className="v2-week-badge">Week {isoWeek(dashboard.today)}</div>
      </div>

      <div style={{ display: 'flex', gap: '8px', margin: '4px 0 8px 0' }}>
        <button 
          onClick={() => setShiftType('am')}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: shiftType === 'am' ? '2px solid #3b82f6' : (darkMode ? '1px solid #334155' : '1px solid #cbd5e1'), background: shiftType === 'am' ? (darkMode ? '#1e3a8a' : '#eff6ff') : 'transparent', color: darkMode ? '#f8fafc' : '#0f172a', fontWeight: 'bold', cursor: 'pointer' }}
        >
          AM Shift (Morning)
        </button>
        <button 
          onClick={() => setShiftType('pm')}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: shiftType === 'pm' ? '2px solid #3b82f6' : (darkMode ? '1px solid #334155' : '1px solid #cbd5e1'), background: shiftType === 'pm' ? (darkMode ? '#1e3a8a' : '#eff6ff') : 'transparent', color: darkMode ? '#f8fafc' : '#0f172a', fontWeight: 'bold', cursor: 'pointer' }}
        >
          PM Shift (Evening)
        </button>
      </div>

      {shiftType === 'am' ? (
        <div className="v2-status-box">
          <div className="v2-status-left">
            <div className="v2-status-label">MORNING (AM) EARNINGS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#047857' }}>£</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={(amVal / 100).toFixed(2)}
                onChange={handleAmInputChange}
                className="v2-earnings-input"
              />
            </div>
            <div className="v2-status-sub">Target for AM: £{gbpFromPence(amTarget)}</div>
          </div>
          <div className="v2-status-divider"></div>
          <div className="v2-status-right">
            <div className="v2-status-label">Difference</div>
            <div className={`v2-status-diff ${diff >= 0 ? "positive" : "negative"}`}>
              {diff < 0 ? "-" : "+"}£{gbpFromPence(Math.abs(diff))}
            </div>
            <div className={`v2-status-sub ${diff >= 0 ? "positive-text" : "negative-text"}`}>
              {diff >= 0 ? "Ahead of target" : "Behind target"}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Current Running Total Card (what driver sees on Uber app) */}
          <div className="v2-pm-current-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: '#0284c7', textTransform: 'uppercase' }}>
                  Current Total (Uber App)
                </div>
                <div style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                  Running total shown on your Uber screen
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7' }}>£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={(pmCurrentTotal / 100).toFixed(2)}
                  onChange={handlePmCurrentTotalChange}
                  className="v2-earnings-input"
                  style={{ width: '110px' }}
                />
              </div>
            </div>
          </div>

          {/* Breakdown & Evening Shift Calculation */}
          <div className="v2-status-box">
            <div className="v2-status-left">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '2px' }}>
                <span>Current Total:</span>
                <span style={{ fontWeight: 700 }}>£{gbpFromPence(pmCurrentTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#ef4444', marginBottom: '6px' }}>
                <span>Morning Shift (deducted):</span>
                <span style={{ fontWeight: 700 }}>-£{gbpFromPence(amVal)}</span>
              </div>
              
              <div style={{ borderTop: darkMode ? '1px solid #334155' : '1px solid #bae6fd', paddingTop: '6px' }}>
                <div className="v2-status-label" style={{ fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                  EVENING SHIFT TOTAL
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '2px 0' }}>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#047857' }}>£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={(pmEveVal / 100).toFixed(2)}
                    onChange={handlePmEveValChange}
                    className="v2-earnings-input"
                    style={{ color: '#047857', fontWeight: 800 }}
                  />
                </div>
                <div className="v2-status-sub">Target for PM: £{gbpFromPence(pmTarget)}</div>
              </div>
            </div>

            <div className="v2-status-divider"></div>

            <div className="v2-status-right">
              <div className="v2-status-label">PM Difference</div>
              <div className={`v2-status-diff ${diff >= 0 ? "positive" : "negative"}`}>
                {diff < 0 ? "-" : "+"}£{gbpFromPence(Math.abs(diff))}
              </div>
              <div className={`v2-status-sub ${diff >= 0 ? "positive-text" : "negative-text"}`}>
                {diff >= 0 ? "Ahead of target" : "Behind target"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Adjustment Buttons */}
      <div className="v2-btn-grid">
        <button className="v2-btn-add" onClick={() => add(100)}>+£1</button>
        <button className="v2-btn-add" onClick={() => add(500)}>+£5</button>
        <button className="v2-btn-add" onClick={() => add(1000)}>+£10</button>
        <button className="v2-btn-add" onClick={() => add(2000)}>+£20</button>
        
        <button className="v2-btn-sub" onClick={() => add(-100)}>-£1</button>
        <button className="v2-btn-sub" onClick={() => add(-500)}>-£5</button>
        <button className="v2-btn-sub" onClick={() => add(-1000)}>-£10</button>
        <button className="v2-btn-sub" onClick={() => add(-2000)}>-£20</button>
      </div>

      <div style={{ textAlign: 'center', fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b' }}>
        Day Total: <strong>£{gbpFromPence(amVal + (shiftType === 'pm' ? pmEveVal : pmInitial))}</strong>
        {amVal > 0 && <span> (Morning: £{gbpFromPence(amVal)} + Evening: £{gbpFromPence(shiftType === 'pm' ? pmEveVal : pmInitial)})</span>}
      </div>

      <div className="v2-action-row">
        <button className="v2-btn-cancel" onClick={onCancel}>CANCEL</button>
        <button 
          className="v2-btn-save" 
          onClick={() => {
            if (shiftType === 'am') {
              onSave('am', amVal, pmEveVal);
            } else {
              onSave('pm', pmEveVal, amVal);
            }
          }}
        >
          {shiftType === 'am' 
            ? `SAVE AM EARNINGS (£${gbpFromPence(amVal)})` 
            : `SAVE EVENING SHIFT (£${gbpFromPence(pmEveVal)})`}
        </button>
      </div>
    </div>
  );
}
