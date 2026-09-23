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

export function DailyEarningsPanel({ dashboard, onCancel, onSave }: { dashboard: UberDashboard; onCancel: () => void; onSave: (previewPence: number) => Promise<void> }) {
  const [val, setVal] = useState(dashboard.todayEarningsPence);

  const add = (amountPence: number) => setVal(v => Math.max(0, v + amountPence));
  const diff = val - ((dashboard.todayTargetPence || 0) || 0);

  return (
    <div className="v2-earnings-modal">
      <header className="v2-earnings-header">
        <div className="v2-brand">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2L2 22h20L12 2z"/></svg>
          MAP-ENGINE V3
        </div>
        <button className="v2-close" onClick={onCancel}>✕</button>
      </header>

      <div className="v2-title-row">
        <div className="v2-title-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#2b75d6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="#2b75d6"/></svg>
            <h2>Update Today's Earnings</h2>
          </div>
          <div className="v2-date">{longDate(dashboard.today)}</div>
        </div>
        <div className="v2-week-badge">Week {isoWeek(dashboard.today)}</div>
      </div>

      <div className="v2-status-box">
        <div className="v2-status-left">
          <div className="v2-status-label">Current Earnings Today</div>
          <div className="v2-status-value">£{gbpFromPence(val)}</div>
          <div className="v2-status-sub">Target for today: £{gbpFromPence(dashboard.todayTargetPence || 0)}</div>
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

      <div className="v2-action-row">
        <button className="v2-btn-cancel" onClick={onCancel}>CANCEL</button>
        <button className="v2-btn-save" onClick={() => onSave(val)}>SAVE & UPDATE</button>
      </div>
    </div>
  );
}
