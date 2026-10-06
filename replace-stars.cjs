const fs = require('fs');

let overlay = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

const pphRowRegex = /\{\/\* PPH ROW \*\/\}[\s\S]*?\{\/\* BOTTOM ROW \*\/\}/m;
overlay = overlay.replace(pphRowRegex, '{/* BOTTOM ROW */}');

const bottomRowRegex = /<div style=\{\{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '2px' \}\}>[\s\S]*?<\/div>\s*<\/div>\s*\{\/\* Clickable Zones/m;

const newBottomRow = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '2px' }}>
          <span style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#cbd5e1' : '#475569' }}>
              {Math.floor(dashboard.todayEarningsPence / 100)}
            </span>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: darkMode ? '#64748b' : '#94a3b8' }}>/HR</span>
            <span style={{ fontSize: '18px', fontWeight: 900, color: activeShift ? pphColor : (darkMode ? '#64748b' : '#94a3b8') }}>
              {activeShift ? Math.floor(shiftPph / 100) : '-'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 30, position: 'relative' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#cbd5e1' : '#475569' }}>
                {Math.floor(blockTargetPence / 100)}
              </span>
              {!activeShift ? (
                <button onClick={() => onStartShift(dashboard.todayEarningsPence)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>START SHIFT</button>
              ) : (
                <button onClick={() => onEndShift(activeShift.id, dashboard.todayEarningsPence)} style={{ background: 'transparent', color: darkMode ? '#ef4444' : '#dc2626', border: \`1px solid \${darkMode ? '#ef4444' : '#dc2626'}\`, padding: '5px 11px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>END SHIFT</button>
              )}
          </div>
        </div>

        </div>
          
        {/* Clickable Zones`;

overlay = overlay.replace(bottomRowRegex, newBottomRow);

fs.writeFileSync('src/map/V3UberOverlay.tsx', overlay);
