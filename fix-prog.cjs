const fs = require('fs');
let c = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');
c = c.replace(
  /<div className="session-progress-fill" style=\{\{ width: `\$\{percent\}%` \}\}>\s*<span className="session-progress-text">\{percent\}%<\/span>\s*<\/div>/g,
  `<div className="session-progress-fill" style={{ width: \`\${percent}%\` }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', zIndex: 2, pointerEvents: 'none' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: percent > 10 ? '#000' : '#fff', textShadow: percent > 10 ? 'none' : '0 1px 3px rgba(0,0,0,0.8)', transition: 'color 0.3s' }}>
                  {(dashboard.todayEarningsPence / 100).toFixed(2).replace('.00', '')}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: percent > 90 ? '#000' : '#8ba2b3', textShadow: percent > 90 ? 'none' : '0 1px 3px rgba(0,0,0,0.8)', transition: 'color 0.3s' }}>
                  {dashboard.todayTargetPence ? (dashboard.todayTargetPence / 100).toFixed(2).replace('.00', '') : '--'}
                </span>
              </div>`
);
fs.writeFileSync('src/map/V3UberOverlay.tsx', c);
