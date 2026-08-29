const TRAFFIC_FLOW = [
  { label: "Gridlock", color: "#6b0f1c", detail: "slower than 35% of free-flow" },
  { label: "Heavy", color: "#e0242d", detail: "35–45% of free-flow" },
  { label: "Slow", color: "#f2a513", detail: "45–60% of free-flow" },
];

const INCIDENTS = [
  { mark: "!", label: "Accident" },
  { mark: "J", label: "Jam" },
  { mark: "L", label: "Lane closed" },
  { mark: "×", label: "Road closed (live)" },
  { mark: "W", label: "Road works" },
  { mark: "~", label: "Flooding" },
  { mark: "B", label: "Broken-down vehicle" },
];

type SafetyItem =
  | { swatch: string; label: string }
  | { chip: string; chipClass: string; label: string }
  | { label: string };

const SAFETY_ITEMS: SafetyItem[] = [
  { swatch: "#ffd34d", label: "Speed camera" },
  { chip: "!", chipClass: "light-chip", label: "Traffic light" },
  { swatch: "#df5948", label: "Road closure (OSM)" },
  { swatch: "#d93636", label: "No entry" },
  { chip: "→", chipClass: "arrow-chip", label: "One-way direction" },
  { chip: "EV", chipClass: "ev-chip", label: "EV charging" },
  { chip: "P", chipClass: "p-chip", label: "Parking" },
  { swatch: "#ef9db0", label: "Restricted / bus-gate zones" },
  { swatch: "#bd7a45", label: "Access-controlled zone" },
  { swatch: "#155844", label: "Clean air zone" },
];

type MapLegendProps = {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
};

function TrafficFlowSection() {
  return (
    <section className="legend-section" aria-label="Live traffic flow">
      <h3>Live traffic flow</h3>
      <p className="legend-note">Roads are coloured when traffic drops below 60% of its typical free-flow speed.</p>
      <ul className="legend-list">
        {TRAFFIC_FLOW.map((s) => (
          <li key={s.label} className="legend-row">
            <span className="legend-swatch" style={{ background: s.color }} aria-hidden="true" />
            <span className="legend-label"><b>{s.label}</b>{s.detail ? <small>{s.detail}</small> : null}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IncidentSection() {
  return (
    <section className="legend-section" aria-label="Traffic incident markers">
      <h3>Live incidents</h3>
      <p className="legend-note">Markers are symbol letters on a shared badge — the colour only adapts to light / dark mode.</p>
      <ul className="legend-list">
        {INCIDENTS.map((g) => (
          <li key={g.mark + g.label} className="legend-row">
            <span className="legend-glyph legend-glyph-badge" aria-hidden="true">{g.mark}</span>
            <span className="legend-label"><b>{g.label}</b></span>
          </li>
        ))}
      </ul>
      <p className="legend-note">“Road closed (live)” is a TomTom live incident. “Road closure (OSM)” in the safety section is a mapped/planned closure from OpenStreetMap.</p>
    </section>
  );
}

function SafetySection() {
  return (
    <section className="legend-section" aria-label="Safety overlays">
      <h3>Safety &amp; road rules</h3>
      <ul className="legend-list">
        {SAFETY_ITEMS.map((item, index) => {
          const key = "label" in item ? item.label + index : String(index);
          if ("swatch" in item) {
            return (
              <li key={key} className="legend-row">
                <span className="legend-swatch" style={{ background: item.swatch }} aria-hidden="true" />
                <span className="legend-label"><b>{item.label}</b></span>
              </li>
            );
          }
          if ("chip" in item) {
            return (
              <li key={key} className="legend-row">
                <span className={`legend-chip ${item.chipClass}`} aria-hidden="true">{item.chip}</span>
                <span className="legend-label"><b>{item.label}</b></span>
              </li>
            );
          }
          return (
            <li key={key} className="legend-row">
              <span className="legend-label legend-label-only"><b>{item.label}</b></span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function MapLegend({ open, onClose, darkMode }: MapLegendProps) {
  if (!open) return null;
  return (
    <aside className={`legend-panel ${darkMode ? "legend-dark" : ""}`} aria-label="Map legend" role="dialog" aria-modal="false">
      <header className="legend-header">
        <h2>Map legend</h2>
        <button type="button" className="legend-close" onClick={onClose} aria-label="Close legend">×</button>
      </header>
      <div className="legend-body">
        <TrafficFlowSection />
        <IncidentSection />
        <SafetySection />
      </div>
    </aside>
  );
}