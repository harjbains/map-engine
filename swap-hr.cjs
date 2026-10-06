const fs = require('fs');

let overlay = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

overlay = overlay.replace(
  /<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>\s*<span style={{ fontSize: '12px', fontWeight: 800, color: darkMode \? '#64748b' : '#94a3b8' }}>\/HR<\/span>\s*<span style={{ fontSize: '18px', fontWeight: 900, color: activeShift \? pphColor : \(darkMode \? '#64748b' : '#94a3b8'\) }}>\s*\{activeShift \? Math\.floor\(shiftPph \/ 100\) : '-'\}\s*<\/span>\s*<\/div>/m,
  `<div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '20px', fontWeight: 900, color: activeShift ? pphColor : (darkMode ? '#64748b' : '#94a3b8') }}>
                {activeShift ? Math.floor(shiftPph / 100) : '-'}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: darkMode ? '#64748b' : '#94a3b8' }}>/HR</span>
            </div>`
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', overlay);
