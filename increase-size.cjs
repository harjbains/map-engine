const fs = require('fs');

let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// Replace left total size
file = file.replace(
  /<span style=\{\{ fontSize: '18px', fontWeight: 800, color: primaryText \}\}>\s*\{Math\.floor\(dashboard\.todayEarningsPence \/ 100\)\}\s*<\/span>/g,
  `<span style={{ fontSize: '24px', fontWeight: 800, color: primaryText }}>
            {Math.floor(dashboard.todayEarningsPence / 100)}
          </span>`
);

// Replace right block target size
file = file.replace(
  /<span style=\{\{ fontSize: '18px', fontWeight: 800, color: primaryText \}\}>\s*\{Math\.floor\(blockTargetPence \/ 100\)\}\s*<\/span>/g,
  `<span style={{ fontSize: '24px', fontWeight: 800, color: primaryText }}>
            {Math.floor(blockTargetPence / 100)}
          </span>`
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
