const fs = require('fs');
let overlay = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

overlay = overlay.replace(
  /<span style={{ fontSize: '15px', fontWeight: 700, color: darkMode \? '#cbd5e1' : '#475569' }}>\s*\{Math\.floor\(blockTargetPence \/ 100\)\}\s*<\/span>/m,
  `<div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 30, position: 'relative' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569' }}>
                {Math.floor(blockTargetPence / 100)}
              </span>
              {!activeShift ? (
                <button onClick={() => onStartShift(dashboard.todayEarningsPence)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>START SHIFT</button>
              ) : (
                <button onClick={() => onEndShift(activeShift.id, dashboard.todayEarningsPence)} style={{ background: 'transparent', color: darkMode ? '#ef4444' : '#dc2626', border: \`1px solid \${darkMode ? '#ef4444' : '#dc2626'}\`, padding: '5px 11px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>END SHIFT</button>
              )}
            </div>`
);

overlay = overlay.replace(
  /\{\/\* Shift Buttons \*\/\}[\s\S]*?<\/div>\s*<\/footer>/,
  '</footer>'
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', overlay);
