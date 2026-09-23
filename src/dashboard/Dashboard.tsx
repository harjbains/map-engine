import { useState, useEffect } from "react";
import type { UberDashboard } from "../uber/types.js";
import type { ReactNode } from "react";
import { gbpFromPence, milesFromTenths } from "../uber/money.js";
import "./dashboard.css";
import "./dashboard-actions.css";

const gbp = (pence: number) => `£${gbpFromPence(pence)}`;
const dayName = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" }).format(new Date(`${date}T12:00:00Z`));
const longDate = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(`${date}T12:00:00Z`));

export function AnimatedProgressBar({ earningsPence, targetPence, forecastBand, darkMode }: { earningsPence: number; targetPence: number; forecastBand: string; darkMode?: boolean }) {
  const [animPct, setAnimPct] = useState(0);
  const percentage = targetPence > 0 ? Math.min(100, Math.floor((earningsPence / targetPence) * 100)) : 0;
  const color = forecastBand === 'gold' ? '#eab308' : forecastBand === 'teal' ? '#06b6d4' : '#64748b';

  useEffect(() => {
    const t = setTimeout(() => setAnimPct(percentage), 150);
    return () => clearTimeout(t);
  }, [percentage]);

  return (
    <div style={{ width: "100%", height: "18px", background: darkMode !== false ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.5)", border: `2px solid ${color}`, borderRadius: "10px", position: "relative", overflow: "hidden", marginTop: "8px" }}>
      <div style={{ width: `${animPct}%`, height: "100%", background: color, transition: "width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.4s ease", position: "relative", overflow: "hidden" }}>
        <div className="progress-shine" style={{ position: "absolute", inset: 0 }} />
      </div>
    </div>
  );
}

export function TeslaUberDashboard({ dashboard, preview = false, onClose, onUpdate, onMileage, onPlan, onUpdateHistoricalDay, onChangeDate, darkMode, onToggleDarkMode }: { dashboard: UberDashboard; preview?: boolean; onClose?: () => void; onUpdate?: () => void; onMileage?: () => void; onPlan?: () => void; onUpdateHistoricalDay?: (date: string) => void; onChangeDate?: (date: string | null) => void; darkMode?: boolean; onToggleDarkMode?: () => void; }) {
  const { summary } = dashboard;
  const progress = summary.weeklyTargetPence === 0 ? 0 : Math.min(100, Math.round((summary.weeklyEarningsPence / summary.weeklyTargetPence) * 100));
  const difference = dashboard.aheadBehindPence;
  const todayTarget = dashboard.todayTargetPence;

  return <main className="tesla-shell" aria-label="Uber earnings dashboard">
    <section className="dashboard" aria-label="Map-Engine V3 dashboard">
      {preview && <div className="preview-badge">PREVIEW DATA — CONNECT SUPABASE TO LOAD YOUR ACCOUNT</div>}

      <div className="date-row">
          <time>{longDate(dashboard.today)}</time>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{display:"flex",gap:"10px",alignItems:"center"}}>
              <button type="button" style={{background:"none",border:"none",color:"#53cfff",fontSize:"1.2rem",cursor:"pointer"}} onClick={() => {
                const d = new Date(dashboard.today + "T12:00:00Z");
                d.setUTCDate(d.getUTCDate() - 7);
                onChangeDate?.(d.toISOString().slice(0,10));
              }}>◀</button>
              Week {isoWeek(dashboard.today)}
              <button type="button" style={{background:"none",border:"none",color:"#53cfff",fontSize:"1.2rem",cursor:"pointer"}} onClick={() => {
                const d = new Date(dashboard.today + "T12:00:00Z");
                d.setUTCDate(d.getUTCDate() + 7);
                onChangeDate?.(d.toISOString().slice(0,10));
              }}>▶</button>
              <button type="button" style={{background:"none",border:"none",color:"#53cfff",fontSize:"0.8rem",cursor:"pointer"}} onClick={() => onChangeDate?.(null)}>TODAY</button>
            </span>
            {onClose && <button type="button" className="uber-close-btn" aria-label="Close" onClick={onClose} style={{ marginLeft: "12px" }}>✕</button>}
          </div>
        </div>

      <section className="hero-panel">
        <div className="hero-icon" aria-hidden="true">🚕</div>
        <div className="hero-copy" style={{ flex: 1 }}>
          <div className="eyebrow">TODAY</div>
          <div className="hero-money">{gbp(dashboard.todayEarningsPence)}</div>
          <div className="target-line">{todayTarget === null ? "No target planned" : `Target: ${gbp(todayTarget)}`}</div>
          <AnimatedProgressBar earningsPence={dashboard.todayEarningsPence} targetPence={dashboard.todayTargetPence || 0} forecastBand={dashboard.forecastBand || 'grey'} darkMode={darkMode} />
        </div>
        <div className={`difference ${difference === null ? "muted" : difference >= 0 ? "positive" : "negative"}`}>
          <strong>{difference === null ? "—" : `${difference >= 0 ? "+" : "-"}${gbp(Math.abs(difference))}`}</strong>
          <span>{difference === null ? "Unplanned" : difference >= 0 ? "Ahead" : "Behind"}</span>
        </div>
      </section>

      <section className="metric-grid">
        <Metric icon="📅" label="THIS WEEK" value={gbp(summary.weeklyEarningsPence)} detail={`of ${gbp(summary.weeklyTargetPence)}`}>
          <div className="progress"><i style={{ width: `${progress}%` }} /><b>{progress}%</b></div>
        </Metric>
        <Metric icon="🔮" label="FORECAST" value={gbp(dashboard.weeklyForecastPence || 0)} detail={<span style={{ color: (dashboard.forecastBand || 'grey') === 'gold' ? '#eab308' : (dashboard.forecastBand || 'grey') === 'teal' ? '#06b6d4' : '#64748b', fontWeight: 'bold' }}>Band: {(dashboard.forecastBand || 'grey').toUpperCase()}</span>} />
        <article className="metric-card" style={{ cursor: "pointer", display: "flex", flexDirection: "column" }} onClick={onMileage}>
          <div className="metric-top"><i>🛣️</i><span>BUSINESS MILES</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", paddingTop: "4px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <strong style={{ fontSize: "1.15rem", marginTop: 0 }}>{milesFromTenths(dashboard.todayMilesTenths)}</strong>
              <small style={{ marginTop: 0 }}>Today</small>
            </div>
            <div style={{ display: "flex", flexDirection: "column", textAlign: "right" }}>
              <strong style={{ fontSize: "1.15rem", marginTop: 0 }}>{milesFromTenths(summary.weeklyMilesTenths)}</strong>
              <small style={{ marginTop: 0 }}>Week</small>
            </div>
          </div>
        </article>
      </section>

      <section className="week-strip" aria-label="Monday to Sunday earnings breakdown">
        {dashboard.days.map((day) => <article key={day.date} className={`day-card ${day.date === dashboard.today ? "today" : ""} ${day.status === "missed" ? "missed" : ""}`} onClick={() => onUpdateHistoricalDay?.(day.date)} style={{cursor:"pointer", paddingBottom:"18px"}}>
          <span>{dayName(day.date)}</span>
          <strong>{day.actualPence === null ? "—" : gbp(day.actualPence)}</strong>
          <small>{day.targetPence === null ? "—" : gbp(day.targetPence)}</small>
          <small>{day.workWeight?.toUpperCase() ?? "OFF"}</small>
          <i aria-label={day.status}>{day.status === "completed" ? "✓" : day.status === "missed" ? "✗" : day.isWorking ? "●" : "○"}</i>
          <div style={{position:"absolute", bottom:"4px", left:0, right:0, textAlign:"center", fontSize:"0.65rem", color:"#7ab0c7"}}>{day.actualMilesTenths !== null ? milesFromTenths(day.actualMilesTenths) : "0.0"} mi</div>
        </article>)}
      </section>

      <nav className="uber-dashboard-actions" aria-label="Uber actions">
        {onUpdate && <button type="button" onClick={onUpdate}>UPDATE EARNINGS</button>}
        {onMileage && <button type="button" onClick={onMileage}>BUSINESS MILES</button>}
        {onPlan && <button type="button" onClick={onPlan}>WEEKLY PLAN</button>}
      </nav>

    </section>
  </main>;
}

function Metric({ icon, label, value, detail, children }: { icon: string; label: string; value: string; detail: ReactNode; children?: ReactNode }) {
  return <article className="metric-card"><div className="metric-top"><i>{icon}</i><span>{label}</span></div><strong>{value}</strong><small>{detail}</small>{children}</article>;
}

function isoWeek(date: string): number {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil((((value.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}
