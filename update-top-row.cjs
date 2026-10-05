const fs = require('fs');

let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// 1. Remove the appended text
file = file.replace(
  /if \(\!isTargetUnlocked && dailyTargetPence > 0\) \{\s*topLeftText \+= `[^`]+`;\s*\}/g,
  ``
);

// 2. Rewrite the TOP ROW container
const topRowOriginal = `<div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '11px', fontWeight: 800, color: goldText, letterSpacing: '0.5px' }}>
            <span>{topLeftText}</span>
              <span>{topRightText}</span>
          </div>`;

const topRowNew = `<div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', width: '100%', fontSize: '11px', fontWeight: 800, color: goldText, letterSpacing: '0.5px' }}>
            <span style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{topLeftText}</span>
            {dailyTargetPence > 0 && !isTargetUnlocked ? (
              <span style={{ textAlign: 'center', color: darkMode ? '#64748b' : '#94a3b8' }}>
                {Math.floor(dailyTargetPence / 100)}
              </span>
            ) : <span />}
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{topRightText}</span>
          </div>`;

file = file.replace(
  /<div style=\{\{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '11px', fontWeight: 800, color: goldText, letterSpacing: '0\.5px' \}\}>\s*<span>\{topLeftText\}<\/span>\s*<span>\{topRightText\}<\/span>\s*<\/div>/g,
  topRowNew
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
