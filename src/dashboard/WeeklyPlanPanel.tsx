import { useMemo, useState } from "react";
import { allocateDailyTargets } from "../uber/calculations.js";
import { gbpFromPence, penceFromGbp } from "../uber/money.js";
import { type UberDashboard, type WeekPlanDay, type WorkWeight } from "../uber/types.js";
import "./uber-panels.css";

const OPTIONS: Array<{ label: string; value: WorkWeight | null }> = [
  { label: "OFF", value: null }, { label: "LIGHT", value: "light" }, { label: "NORMAL", value: "normal" }, { label: "HEAVY", value: "heavy" },
];
const labelDate = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" }).format(new Date(`${date}T12:00:00Z`));

export function WeeklyPlanPanel({ dashboard, onCancel, onSave }: { dashboard: UberDashboard; onCancel: () => void; onSave: (targetPence: number, weights: Array<WorkWeight | null>) => Promise<void> }) {
  const [targetString, setTargetString] = useState(() => gbpFromPence(dashboard.summary.weeklyTargetPence));
  const targetPence = useMemo(() => {
    try {
      const p = penceFromGbp(targetString);
      return isNaN(p) ? 0 : Math.max(0, p);
    } catch {
      return 0;
    }
  }, [targetString]);

  const [weights, setWeights] = useState<Array<WorkWeight | null>>(() => dashboard.days.map((day) => day.isWorking ? day.workWeight ?? "normal" : null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targets = useMemo(() => new Map(allocateDailyTargets(targetPence, dashboard.days.map((day, index): WeekPlanDay => ({
    date: day.date, weekStart: dashboard.summary.weekStart, isWorking: weights[index] !== null, workWeight: weights[index] ?? "normal", createdAt: "", updatedAt: "",
  }))).map((target) => [target.date, target.targetPence])), [dashboard, weights, targetPence]);

  const save = async () => {
    setSaving(true); setError(null);
    try { await onSave(targetPence, weights); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save plan"); setSaving(false); }
  };

  const cycleWeight = (current: WorkWeight | null): WorkWeight | null => {
    if (current === null) return "light";
    if (current === "light") return "normal";
    if (current === "normal") return "heavy";
    if (current === "heavy") return null;
    return null;
  };

  return <section className="uber-panel" aria-label="Weekly plan">
    <header><div><small>MAP-ENGINE V3.3.1</small><h1>Weekly Plan</h1><p>Edit your weekly target and tap a day to cycle intensity</p></div><button type="button" aria-label="Close weekly plan" onClick={onCancel}>✕</button></header>
    
    <div style={{ padding: "16px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", margin: "10px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <label htmlFor="target-input" style={{ fontWeight: 800, fontSize: "0.9rem", color: "#aee5f9" }}>WEEKLY TARGET (£)</label>
      <input 
        id="target-input"
        type="number"
        step="1"
        value={targetString}
        onChange={(e) => setTargetString(e.target.value)}
        style={{ width: "120px", padding: "8px", borderRadius: "6px", border: "1px solid #07506d", background: "#010a0f", color: "#68f3c5", fontSize: "1.2rem", fontWeight: 800, textAlign: "right" }}
      />
    </div>

    <div className="week-strip" style={{ margin: "10px 0" }}>
      {dashboard.days.map((day, index) => {
        const weight = weights[index];
        const target = targets.get(day.date);
        return (
          <article key={day.date} className={`day-card ${weight ? "working" : "off"}`} style={{ cursor: "pointer" }} onClick={() => setWeights(current => current.map((w, i) => i === index ? cycleWeight(w) : w))}>
            <span>{new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" }).format(new Date(`${day.date}T12:00:00Z`))}</span>
            <strong>{target ? `£${gbpFromPence(target)}` : "—"}</strong>
              <small>{weight ? weight.toUpperCase() : "OFF"}</small>
              <i>{weight ? "✓" : " "}</i>
            </article>
        );
      })}
    </div>

    <p className="uber-panel-note">Targets are calculated in whole pennies. OFF days have no target; actual earnings are never changed by editing the plan.</p>
    {error && <p className="uber-panel-error" role="alert">{error}</p>}
    <footer><button type="button" onClick={onCancel} disabled={saving}>CANCEL</button><button className="save" type="button" onClick={() => void save()} disabled={saving}>{saving ? "SAVING..." : "SAVE PLAN"}</button></footer>
  </section>;
}
