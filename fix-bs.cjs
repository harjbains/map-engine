const fs = require('fs');
for (const file of ['src/dashboard/WeeklyPlanPanel.tsx', 'src/map/V3UberOverlay.tsx']) {
  let f = fs.readFileSync(file, 'utf8');
  f = f.replace(/\\\`/g, '`');
  f = f.replace(/\\\$/g, '$');
  fs.writeFileSync(file, f);
}
