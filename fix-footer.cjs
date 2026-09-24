const fs = require('fs');

let c = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

const replacement = `
  let currentMaxTarget = dashboard.todayTargetPence || 0;
  let targetUnlocked = false;
  if (currentMaxTarget > 0) {
    while (dashboard.todayEarningsPence >= currentMaxTarget) {
      currentMaxTarget += 2500;
      targetUnlocked = true;
    }
  }

  const isNearlyReached = currentMaxTarget > 0 && (currentMaxTarget - dashboard.todayEarningsPence) <= 1000;
  const barColor = targetUnlocked ? "#eab308" : "#3b82f6";
  const percent = currentMaxTarget ? Math.min(100, Math.floor((dashboard.todayEarningsPence / currentMaxTarget) * 100)) : 0;

  return <>
    <footer className="uber-session-footer">
      <button type="button" className="session-progress" onClick={() => setModal("editor")} aria-label="Open Update Earnings screen" style={{ borderRight: 'none', padding: 0 }}>
        <div className="session-progress-track" style={{ height: '38px', borderRadius: '8px', border: '1px solid #2a3a46' }}>
          <div className="session-progress-fill" style={{ width: \`\${percent}%\`, background: barColor }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', zIndex: 2, pointerEvents: 'none' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: percent > 10 ? '#000' : '#fff', textShadow: percent > 10 ? 'none' : '0 1px 3px rgba(0,0,0,0.8)', transition: 'color 0.3s' }}>
                {(dashboard.todayEarningsPence / 100).toFixed(2).replace('.00', '')}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: percent > 75 ? '#000' : '#8ba2b3', textShadow: percent > 75 ? 'none' : '0 1px 3px rgba(0,0,0,0.8)', transition: 'color 0.3s' }}>
                {isNearlyReached ? "Target nearly reached!" : (currentMaxTarget / 100).toFixed(2).replace('.00', '')}
              </span>
            </div>
        </div>
      </button>
    </footer>
    <MilestoneCelebration transition={activeTransition} onComplete={() => setActiveTransition(null)} />
`;

c = c.replace(/const forecastBand = [\s\S]*?<MilestoneCelebration[^>]+>/, replacement.trim());

fs.writeFileSync('src/map/V3UberOverlay.tsx', c);
