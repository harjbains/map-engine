import { useMemo, useState } from "react";
import { gbpFromPence } from "../uber/money.js";
import { type UberDashboard } from "../uber/types.js";
import "./uber-panels.css";

const formatWeekday = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" }).format(new Date(`${date}T12:00:00Z`));

export function WeeklyPlanPanel({ dashboard, onCancel, onSave }: { dashboard: UberDashboard; onCancel: () => void; onSave: (amTargets: number[], pmTargets: number[]) => Promise<void> }) {
  const [amTargets, setAmTargets] = useState<number[]>(() => dashboard.days.map((day) => day.amTargetPence ?? 0));
  const [pmTargets, setPmTargets] = useState<number[]>(() => dashboard.days.map((day) => day.pmTargetPence ?? 0));
  
  const [editing, setEditing] = useState<{ dayIndex: number; shift: 'am' | 'pm' } | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const weeklyTargetPence = useMemo(() => {
    return amTargets.reduce((a, b) => a + b, 0) + pmTargets.reduce((a, b) => a + b, 0);
  }, [amTargets, pmTargets]);

  const save = async () => {
    setSaving(true); setError(null);
    try { await onSave(amTargets, pmTargets); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save plan"); setSaving(false); }
  };
  
  const handleAdjust = (deltaPence: number) => {
    if (!editing) return;
    if (editing.shift === 'am') {
      setAmTargets(prev => {
        const next = [...prev];
        next[editing.dayIndex] = Math.max(0, next[editing.dayIndex] + deltaPence);
        return next;
      });
    } else {
      setPmTargets(prev => {
        const next = [...prev];
        next[editing.dayIndex] = Math.max(0, next[editing.dayIndex] + deltaPence);
        return next;
      });
    }
  };

  return <section className="uber-panel" aria-label="Weekly plan" onClick={() => setEditing(null)}>
    <header><div><small>MAP-ENGINE V3.4.7</small><h1>Weekly Plan</h1><p>Edit your AM and PM shift targets</p></div><button type="button" className="uber-close-btn" aria-label="Close weekly plan" onClick={onCancel}>{"\u00D7"}</button></header>
    
    <div className="uber-plan-target">
      <label>WEEKLY TARGET</label>
      <div>{"\u00A3"}{gbpFromPence(weeklyTargetPence)}</div>
    </div>

    <div className="uber-plan-am-pm-grid">
      {dashboard.days.map((day, index) => {
        const isEditingAm = editing?.dayIndex === index && editing.shift === 'am';
        const isEditingPm = editing?.dayIndex === index && editing.shift === 'pm';
        const isAmActive = amTargets[index] > 0;
        const isPmActive = pmTargets[index] > 0;
        
        return (
          <div key={day.date} className="uber-plan-day-column">
            <div className="day-name">{formatWeekday(day.date).toUpperCase()}</div>
            
            {/* AM Box */}
            <div 
              onClick={(e) => { e.stopPropagation(); setEditing(isEditingAm ? null : { dayIndex: index, shift: 'am' }); }}
              className={`shift-box am ${isEditingAm ? 'editing' : ''} ${isAmActive ? 'active' : ''}`}
            >
              <div className="shift-label">AM</div>
              <div className="shift-val">{isAmActive ? `\u00A3${gbpFromPence(amTargets[index])}` : 'OFF'}</div>
            </div>
            
            {/* PM Box */}
            <div 
              onClick={(e) => { e.stopPropagation(); setEditing(isEditingPm ? null : { dayIndex: index, shift: 'pm' }); }}
              className={`shift-box pm ${isEditingPm ? 'editing' : ''} ${isPmActive ? 'active' : ''}`}
            >
              <div className="shift-label">PM</div>
              <div className="shift-val">{isPmActive ? `\u00A3${gbpFromPence(pmTargets[index])}` : 'OFF'}</div>
            </div>
          </div>
        );
      })}
    </div>

    {editing && (
      <div onClick={(e) => e.stopPropagation()} className="uber-plan-editor">
        <button type="button" onClick={() => handleAdjust(-2500)}>- {"\u00A3"}25</button>
        <div className="editor-val">
          {editing.shift === 'am' 
            ? (amTargets[editing.dayIndex] > 0 ? `\u00A3${gbpFromPence(amTargets[editing.dayIndex])}` : 'OFF')
            : (pmTargets[editing.dayIndex] > 0 ? `\u00A3${gbpFromPence(pmTargets[editing.dayIndex])}` : 'OFF')}
        </div>
        <button type="button" onClick={() => handleAdjust(2500)}>+ {"\u00A3"}25</button>
      </div>
    )}

    {error && <p className="uber-panel-error" role="alert">{error}</p>}
    <footer><button type="button" onClick={onCancel} disabled={saving}>CANCEL</button><button className="save" type="button" onClick={() => void save()} disabled={saving}>{saving ? "SAVING..." : "SAVE PLAN"}</button></footer>
  </section>;
}