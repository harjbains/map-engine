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

      {(() => {
  const pct = (dashboard.todayTargetPence || 0) > 0 ? Math.floor((dashboard.todayEarningsPence / dashboard.todayTargetPence!) * 100) : 0;
  const hash = [...dashboard.today].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 4;
  let title = "LET'S GET STARTED";
  let sub = "First milestone awaits";

  if (pct >= 100) {
    const msgs = [
      { title: "BONUS TIME!", sub: "Every extra £ counts" },
      { title: "TARGET COMPLETE", sub: "You've earned your gold" },
      { title: "GOLD UNLOCKED", sub: "Extra earnings unlocked" },
      { title: "LEVEL COMPLETE", sub: "Another milestone achieved" }
    ];
    ({title, sub} = msgs[hash % msgs.length]);
  } else if (pct >= 90) {
    const msgs = [
      { title: "SO CLOSE!", sub: "Nearly at your target" },
      { title: "BONUS TIME AHEAD", sub: "One more milestone" },
      { title: "THE FINISH LINE", sub: "Almost there" },
      { title: "GOLD IN SIGHT", sub: "Your next level awaits" }
    ];
    ({title, sub} = msgs[hash % msgs.length]);
  } else if (pct >= 75) {
    const msgs = [
      { title: "FINAL STRETCH", sub: "Target in sight" },
      { title: "CLOSING IN", sub: "You're getting closer" },
      { title: "ALMOST THERE", sub: "Keep the momentum" },
      { title: "TARGET IN SIGHT", sub: "Bonus time awaits" }
    ];
    ({title, sub} = msgs[hash % msgs.length]);
  } else if (pct >= 50) {
    const msgs = [
      { title: "HALFWAY THERE", sub: "Keep that momentum" },
      { title: "LOOKING GOOD", sub: "Target getting closer" },
      { title: "STAY IN THE GAME", sub: "Keep building your total" },
      { title: "OVER HALFWAY", sub: "The next level awaits" }
    ];
    ({title, sub} = msgs[hash % msgs.length]);
  } else if (pct >= 25) {
    const msgs = [
      { title: "NICE START", sub: "Keep building" },
      { title: "MOMENTUM BUILDING", sub: "You're on your way" },
      { title: "KEEP IT ROLLING", sub: "Next milestone awaits" },
      { title: "FIND YOUR RHYTHM", sub: "Every £5 adds up" }
    ];
    ({title, sub} = msgs[hash % msgs.length]);
  } else {
    const msgs = [
      { title: "LET'S GET STARTED", sub: "First milestone awaits" },
      { title: "GAME ON", sub: "Every ride counts" },
      { title: "BUILD MOMENTUM", sub: "The day is yours" },
      { title: "FIRST STEPS", sub: "Get the ball rolling" }
    ];
    ({title, sub} = msgs[hash % msgs.length]);
  }

  const nextSquareTarget = Math.floor(dashboard.todayEarningsPence / 500) * 500 + 500;
  const nextSquareAmount = nextSquareTarget - dashboard.todayEarningsPence;
  const isBonus = pct >= 100;

  return (
    <section className="hero-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>TODAY</div>
          <div className="hero-money" style={{ fontSize: '2.5rem', fontWeight: 800, color: '#197a48', lineHeight: 1 }}>{gbp(dashboard.todayEarningsPence)}</div>
          <div className="target-line" style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>{dashboard.todayTargetPence === null ? "No target planned" : `Target: ${gbp(dashboard.todayTargetPence)}`}</div>
        </div>

        <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '16px' }}>
          <div style={{ background: '#dbeafe', color: '#3b82f6', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{title}</div>
          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>{sub}</div>
        </div>

        <div style={{ flex: 1, textAlign: 'right' }}>
          <div className="eyebrow" style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>NEXT {isBonus ? "MILESTONE" : "SQUARE"}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0369a1', lineHeight: 1, marginTop: '4px' }}>{gbp(nextSquareAmount)}</div>
          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>Until {gbp(nextSquareTarget)}</div>
        </div>
      </div>
      <div style={{ marginTop: '-4px' }}>
        <AnimatedProgressBar earningsPence={dashboard.todayEarningsPence} targetPence={dashboard.todayTargetPence || 0} forecastBand={dashboard.forecastBand || 'grey'} darkMode={darkMode} />
      </div>
    </section>
  );
})()}

      <section className="metric-grid">
        <Metric icon="📅" label="THIS WEEK" value={gbp(summary.weeklyEarningsPence)} detail={`of ${gbp(summary.weeklyTargetPence)}`}>
          <div className="progress"><i style={{ width: `${progress}%` }} /><b>{progress}%</b></div>
        </Metric>
        <Metric icon="🔮" label="FORECAST" value={gbp(dashboard.weeklyForecastPence || 0)} detail={<span style={{ color: (dashboard.forecastBand || 'grey') === 'gold' ? '#eab308' : (dashboard.forecastBand || 'grey') === 'teal' ? '#06b6d4' : '#64748b', fontWeight: 'bold' }}>Band: {(dashboard.forecastBand || 'grey').toUpperCase()}{dashboard.provisionalForecast ? " (Provisional)" : ""}</span>} />
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
