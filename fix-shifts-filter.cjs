const fs = require('fs');
let file = fs.readFileSync('src/uber/service.ts', 'utf8');
file = file.replace(/shifts: shifts\.filter\(s => s\.date === today\),/, 'shifts, // Return all shifts for the week so history panel can see them');
fs.writeFileSync('src/uber/service.ts', file);
