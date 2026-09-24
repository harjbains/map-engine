const fs = require('fs');
let tsx = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

const tsxReplacement = `
  return <>
    <footer className="uber-session-footer">
      <button type="button" className="session-progress" onClick={() => setModal("editor")} aria-label="Open Update Earnings screen" style={{ borderRight: 'none', padding: 0 }}>
        <div className="session-progress-track" style={{ height: '38px', borderRadius: '8px', border: '2px solid #000' }}>
          <div className="session-progress-fill" style={{ width: \`\${percent}%\`, background: barColor }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', zIndex: 2, pointerEvents: 'none' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.8)' }}>
                {Math.floor(dashboard.todayEarningsPence / 100)}
              </span>
              {isNearlyReached ? (
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#eab308', textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.8)' }}>
                  Target nearly reached!
                </span>
              ) : (
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#eab308', textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.8)' }}>
                  {Math.floor(currentMaxTarget / 100)}
                </span>
              )}
            </div>
        </div>
      </button>
    </footer>
    <MilestoneCelebration transition={activeTransition} onComplete={() => setActiveTransition(null)} />
`;

tsx = tsx.replace(/return <>\s*<footer className="uber-session-footer">[\s\S]*?<MilestoneCelebration[^>]+>/, tsxReplacement.trim());

fs.writeFileSync('src/map/V3UberOverlay.tsx', tsx);
