const fs = require('fs');
let c = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

c = c.replace(
  "const sqBorder = darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.15)';",
  "const sqBorder = darkMode ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.3)';"
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', c);
console.log("Border contrast increased.");
