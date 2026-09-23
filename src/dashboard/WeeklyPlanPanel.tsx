import { useMemo, useState } from "react";
import { allocateDailyTargets } from "../uber/calculations.js";
import { gbpFromPence } from "../uber/money.js";
import { FIXED_WEEKLY_TARGET_PENCE, type UberDashboard, type WeekPlanDay, type WorkWeight } from "../uber/types.js";
import "./uber-panels.css";

const OPTIONS: Array<{ label: string; value: WorkWeight | null }> = [
  { label: "OFF", value: null }, { label: "LIGHT", value: "light" }, { label: "NORMAL", value: "normal" }, { label: "HEAVY", value: "heavy" },
];
const labelDate = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" }).format(new Date(`${date}T12:00:00Z`));

export function WeeklyPlanPanel({ dashboard, onCancel, onSave }: { dashboard: UberDashboard; onCancel: () => void; onSave: (weights: Array<WorkWeight | null>) => Promise<void> }) {
  const [weights, setWeights] = useState<Array<WorkWeight | null>>(() => dashboard.days.map((day) => day.isWorking ? day.workWeight ?? "normal" : null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targets = useMemo(() => new Map(allocateDailyTargets(FIXED_WEEKLY_TARGET_PENCE, dashboard.days.map((day, index): WeekPlanDay => ({
    date: day.date, weekStart: dashboard.summary.weekStart, isWorking: weights[index] !== null, workWeight: weights[index] ?? "normal", createdAt: "", updatedAt: "",
  }))).map((target) => [target.date, target.targetPence])), [dashboard, weights]);

  const save = async () => {
    setSaving(true); setError(null);
    try { await onSave(weights); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save plan"); setSaving(false); }
  };

  const cycleWeight = (current: WorkWeight | null): WorkWeight | null => {
    if (current === null) return "light";
    if (current === "light") return "normal";
    if (current === "normal") return "heavy";
    if (current === "heavy") return null;
    return null;
  };

  return <section className="uber-panel" aria-label="Weekly plan">
    <header><div><small>MAP-ENGINE V3.1.2</small><h1>Weekly Plan</h1><p>£750.00 weekly target — tap a day to cycle intensity</p></div><button type="button" aria-label="Close weekly plan" onClick={onCancel}>✕</button></header>
    
    <div className="week-strip" style={{ margin: "10px 0" }}>
      {dashboard.days.map((day, index) => {
        const weight = weights[index];
        const target = targets.get(day.date);
        return (
          <article key={day.date} className={`day-card ${weight ? "working" : "off"}`} style={{ cursor: "pointer" }} onClick={() => setWeights(current => current.map((w, i) => i === index ? cycleWeight(w) : w))}>
            <span>{new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" }).format(new Date(`${day.date}T12:00:00Z`))}</span>
            <strong>{target ? `£${gbpFromPence(target)}` : "—"}</strong>
              <small>{weight ? weight.toUpperCase() : "OFF"}</small>
              <i>{weight ? "•" : " "}</i>
            </article>
        );
      })}
    </div>

    <p className="uber-panel-note">Targets are calculated in whole pennies. OFF days have no target; actual earnings are never changed by editing the plan.</p>
    {error && <p className="uber-panel-error" role="alert">{error}</p>}
    <footer><button type="button" onClick={onCancel} disabled={saving}>CANCEL</button><button className="save" type="button" onClick={() => void save()} disabled={saving}>{saving ? "SAVING…" : "SAVE PLAN"}</button></footer>
  </section>;
}
