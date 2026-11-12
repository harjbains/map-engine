import "./uber-panels.css";

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <section className="uber-panel" aria-label="Changelog">
      <header>
        <div>
          <small>MAP-ENGINE</small>
          <h1>v3.3.9 Updates</h1>
          <p>West Midlands Average Speed Zones, Christmas Bauble Theme &amp; Road Styling</p>
        </div>
        <button type="button" aria-label="Close changelog" onClick={onClose}>×</button>
      </header>
      <div style={{ padding: "10px 0", display: "grid", gap: "10px", color: "#d9f5ff", lineHeight: 1.4 }}>
        <article style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h3 style={{ margin: "0 0 4px", color: "#35f1bd", fontSize: "16px" }}>West Midlands Average Speed Zones</h3>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>All 26 West Midlands Average Speed Zone corridors across Wolverhampton, the Black Country, Birmingham, Solihull, and Coventry are highlighted in solid Magenta with live zone HUD warnings.</p>
        </article>
        <article style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h3 style={{ margin: "0 0 4px", color: "#35f1bd", fontSize: "16px" }}>Christmas Shiny Metallic Bauble Theme 🎄</h3>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>Map controls are styled as 3D jewel-toned metallic Christmas baubles with golden caps and hanging rings (toggleable in Settings).</p>
        </article>
        <article style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h3 style={{ margin: "0 0 4px", color: "#35f1bd", fontSize: "16px" }}>Road Widths &amp; Labels</h3>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>Road widths increased by 10% and road name labels reduced by 10% so names sit cleanly inside road casings.</p>
        </article>
        <article style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h3 style={{ margin: "0 0 4px", color: "#35f1bd", fontSize: "16px" }}>Shift Tracking</h3>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>You can now start and end multiple shifts in a day to track your true active £/hr. Check your shift history from the Dashboard!</p>
        </article>
      </div>
      <footer>
        <button type="button" onClick={onClose} style={{ gridColumn: "1 / -1" }}>CLOSE</button>
      </footer>
    </section>
  );
}
