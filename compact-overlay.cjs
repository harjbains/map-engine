const fs = require('fs');

let overlay = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// 1. Footer padding
overlay = overlay.replace(
  /<footer className="uber-session-footer" style=\{\{ height: 'auto', padding: '12px 16px',/g,
  `<footer className="uber-session-footer" style={{ height: 'auto', padding: '6px 12px',`
);

// 2. session-progress gap
overlay = overlay.replace(
  /className="session-progress" style=\{\{ borderRight: 'none', padding: 0, flexDirection: 'column', height: 'auto', gap: '8px',/g,
  `className="session-progress" style={{ borderRight: 'none', padding: 0, flexDirection: 'column', height: 'auto', gap: '4px',`
);

// 3. progress bar height
overlay = overlay.replace(
  /className="session-progress-track" style=\{\{ height: '12px', borderRadius: '6px',/g,
  `className="session-progress-track" style={{ height: '8px', borderRadius: '4px',`
);

// 4 & 5 & 6 & 7: BOTTOM ROW edits
const bottomRowRegex = /\{\/\* BOTTOM ROW \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*\{\/\* Clickable Zones/m;

const newBottomRow = `{/* BOTTOM ROW */}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '0px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#cbd5e1' : '#475569' }}>
                {Math.floor(dashboard.todayEarningsPence / 100)}
              </span>
            
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '20px', fontWeight: 900, color: darkMode ? '#cbd5e1' : '#475569' }}>
                  {activeShift ? Math.floor(shiftPph / 100) : '-'}
                </span>
              </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 30, position: 'relative' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#cbd5e1' : '#475569' }}>
                  {Math.floor(blockTargetPence / 100)}
                </span>
                {!activeShift ? (
                  <button onClick={() => onStartShift(dashboard.todayEarningsPence)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>START</button>
                ) : (
                  <button onClick={() => onEndShift(activeShift.id, dashboard.todayEarningsPence)} style={{ background: 'transparent', color: darkMode ? '#ef4444' : '#dc2626', border: \`1px solid \${darkMode ? '#ef4444' : '#dc2626'}\`, padding: '3px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>END</button>
                )}
            </div>
          </div>

          </div>
            
          {/* Clickable Zones`;

overlay = overlay.replace(bottomRowRegex, newBottomRow);

fs.writeFileSync('src/map/V3UberOverlay.tsx', overlay);
