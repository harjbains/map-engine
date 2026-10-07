const fs = require('fs');

let f = fs.readFileSync('src/dashboard/ShiftHistoryPanel.tsx', 'utf8');
f = f.replace(/\\\`/g, '`');
fs.writeFileSync('src/dashboard/ShiftHistoryPanel.tsx', f);
