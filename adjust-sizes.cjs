const fs = require('fs');

let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// 1. Change top row to center align, make center number larger
file = file.replace(
  /<div style=\{\{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', width: '100%', fontSize: '11px', fontWeight: 800, color: goldText, letterSpacing: '0\.5px' \}\}>/g,
  `<div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', width: '100%', fontSize: '11px', fontWeight: 800, color: goldText, letterSpacing: '0.5px' }}>`
);

file = file.replace(
  /<span style=\{\{ textAlign: 'center', color: darkMode \? '#94a3b8' : '#64748b' \}\}>\s*\{Math\.floor\(dailyTargetPence \/ 100\)\}\s*<\/span>/g,
  `<span style={{ textAlign: 'center', color: darkMode ? '#64748b' : '#94a3b8', fontSize: '18px', fontWeight: 900 }}>
                {Math.floor(dailyTargetPence / 100)}
              </span>`
);
// Notice I flipped the colors slightly for the center to make it SUBTLE but larger. Slate-500 (#64748b) is darker than Slate-400 (#94a3b8) so in dark mode #64748b is more subtle. In light mode #94a3b8 is lighter so it's more subtle.

// 2. Change bottom left/right numbers to be smaller and subtle colors
// Instead of primaryText, we'll use a new subtle color inline.
file = file.replace(
  /<span style=\{\{ fontSize: '24px', fontWeight: 800, color: primaryText \}\}>\s*\{Math\.floor\(dashboard\.todayEarningsPence \/ 100\)\}\s*<\/span>/g,
  `<span style={{ fontSize: '15px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569' }}>
              {Math.floor(dashboard.todayEarningsPence / 100)}
            </span>`
);

file = file.replace(
  /<span style=\{\{ fontSize: '24px', fontWeight: 800, color: primaryText \}\}>\s*\{Math\.floor\(blockTargetPence \/ 100\)\}\s*<\/span>/g,
  `<span style={{ fontSize: '15px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569' }}>
              {Math.floor(blockTargetPence / 100)}
            </span>`
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
