import "./uber-panels.css";

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <section className="uber-panel" aria-label="Changelog">
      <header>
        <div>
          <small>MAP-ENGINE</small>
          <h1>v3.1.2 Updates</h1>
          <p>Light Mode, visual upgrades, and bug fixes</p>
        </div>
        <button type="button" aria-label="Close changelog" onClick={onClose}>×</button>
      </header>
      <div style={{ padding: "10px 0", display: "grid", gap: "10px", color: "#d9f5ff", lineHeight: 1.4 }}>
        <article style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h3 style={{ margin: "0 0 4px", color: "#35f1bd", fontSize: "16px" }}>More UI Refinements</h3>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>Close buttons are now beautifully unified. Light Mode day cards have improved contrast. Dashboard layout is more compact to fit the Tesla screen better. Mileage panel now features +20/-20 adjustment buttons.</p>
        </article>
        <article style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h3 style={{ margin: "0 0 4px", color: "#35f1bd", fontSize: "16px" }}>Light Mode</h3>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>Match your mood with a gorgeous new Light Mode theme! Hit the ☀️ toggle on the dashboard to seamlessly switch the entire UI to match the map.</p>
        </article>
        <article style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h3 style={{ margin: "0 0 4px", color: "#35f1bd", fontSize: "16px" }}>Animated £25 Progress</h3>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>The progress bar is now a solid, animated bar that dynamically changes color as you conquer each £25 block. Includes a satisfying charging animation and £5 markers.</p>
        </article>
        <article style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h3 style={{ margin: "0 0 4px", color: "#35f1bd", fontSize: "16px" }}>Quick Mileage Editing</h3>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>The Weekly History panel has been completely removed. You can now view and edit your daily business miles simply by tapping the days directly on the dashboard!</p>
        </article>
        <article style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h3 style={{ margin: "0 0 4px", color: "#35f1bd", fontSize: "16px" }}>Cloud Sync + Midnight Roller</h3>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>Shifts ending before 04:00 AM still correctly attribute to the previous calendar day, and everything syncs to your Supabase account automatically.</p>
        </article>
      </div>
      <footer>
        <button type="button" onClick={onClose} style={{ gridColumn: "1 / -1" }}>CLOSE</button>
      </footer>
    </section>
  );
}
