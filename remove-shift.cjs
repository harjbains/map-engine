const fs = require('fs');
let c = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

c = c.replace(
  ">\{activeShift.shiftType?.toUpperCase() || 'UNKNOWN'} SHIFT</span>",
  ">{activeShift.shiftType?.toUpperCase() || 'UNKNOWN'}</span>"
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', c);
console.log('Removed SHIFT text properly.');
