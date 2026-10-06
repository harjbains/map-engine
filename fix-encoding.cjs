const fs = require('fs');
let file = fs.readFileSync('src/dashboard/ShiftHistoryPanel.tsx', 'utf8');

// The file currently has "A" because of weird encoding.
file = file.replace(/A/g, '£');
file = file.replace(/\?"/g, '-');
file = file.replace(/\?/g, '•');

fs.writeFileSync('src/dashboard/ShiftHistoryPanel.tsx', file);
