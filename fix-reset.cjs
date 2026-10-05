const fs = require('fs');

let file = fs.readFileSync('src/uber/service.ts', 'utf8');

file = file.replace(
  /\} else if \(existing\.weeklyTargetPence !== FIXED_WEEKLY_TARGET_PENCE\) \{\s*await this\.repository\.updateWeeklyTarget\(weekStart, FIXED_WEEKLY_TARGET_PENCE\);\s*\}/g,
  `}`
);

fs.writeFileSync('src/uber/service.ts', file);
