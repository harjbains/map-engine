const fs = require('fs');

let tsx = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

const replacement = `
  const remainingPence = Math.max(0, currentMaxTarget - dashboard.todayEarningsPence);
  const isNearlyReached = currentMaxTarget > 0 && remainingPence <= 1000;
  const barColor = targetUnlocked ? "#eab308" : "#3b82f6";
  const percent = currentMaxTarget ? Math.min(100, Math.floor((dashboard.todayEarningsPence / currentMaxTarget) * 100)) : 0;
  
  const avgTripPence = dashboard.todayTrips > 0 ? (dashboard.todayEarningsPence / dashboard.todayTrips) : 450;
  const tripsLeft = remainingPence === 0 ? 0 : Math.max(1, Math.ceil(remainingPence / avgTripPence));
  const visualStars = Math.min(tripsLeft, 7);

  return <>
    <footer className="uber-session-footer" style={{ height: 'auto', padding: '12px 16px', flexDirection: 'column', alignItems: 'stretch' }}>
      <button type="button" className="session-progress" onClick={() => setModal("editor")} aria-label="Open Update Earnings screen" style={{ borderRight: 'none', padding: 0, flexDirection: 'column', height: 'auto', gap: '8px', background: 'transparent' }}>
        
        {/* TOP ROW */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '11px', fontWeight: 800, color: '#eab308', letterSpacing: '0.5px' }}>
          <span>{targetUnlocked ? "BONUS TIME" : (isNearlyReached ? "ALMOST THERE" : "ON TRACK")}</span>
          <span>{remainingPence > 0 ? \`\${Math.floor(remainingPence / 100)} TO NEXT MILESTONE\` : "MILESTONE REACHED"}</span>
        </div>

        {/* PROGRESS BAR ROW */}
        <div className="session-progress-track" style={{ height: '12px', borderRadius: '6px', border: '1px solid #000', width: '100%', background: '#334155', flex: 'none', overflow: 'hidden' }}>
          <div className="session-progress-fill" style={{ height: '100%', width: \`\${percent}%\`, background: barColor, borderRadius: '6px', transition: 'width 0.3s ease', padding: 0 }} />
        </div>

        {/* BOTTOM ROW */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '2px' }}>
          <span style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
            {Math.floor(dashboard.todayEarningsPence / 100)}
          </span>
          
          {tripsLeft > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: visualStars }).map((_, i) => (
                  <div key={i} style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#1e293b', border: '1px solid #334155', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <svg viewBox="0 0 24 24" fill="#eab308" width="12" height="12"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </div>
                ))}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#eab308' }}>
                {tripsLeft} left
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>TARGET MET</span>
          )}

          <span style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
            {Math.floor(currentMaxTarget / 100)}
          </span>
        </div>

      </button>
    </footer>
`;

tsx = tsx.replace(/const isNearlyReached = [\s\S]*?<\/button>\s*<\/footer>/, replacement.trim());
fs.writeFileSync('src/map/V3UberOverlay.tsx', tsx);
