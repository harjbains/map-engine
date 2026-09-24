const fs = require('fs');
let c = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');
c = c.replace('setActiveTransition(null)} /> setActiveTransition(null)} />', 'setActiveTransition(null)} />');
fs.writeFileSync('src/map/V3UberOverlay.tsx', c);
