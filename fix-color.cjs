const fs = require('fs');
let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');
file = file.replace(/darkMode \? '#64748b' : '#94a3b8'/g, "darkMode ? '#94a3b8' : '#64748b'");
fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
