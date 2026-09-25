const fs = require('fs');
let file = fs.readFileSync('src/dashboard/Dashboard.tsx', 'utf8');

file = file.replace(/const pct = dashboard.todayTargetPence > 0 \? Math.floor\(\(dashboard.todayEarningsPence \/ dashboard.todayTargetPence\) \* 100\) : 0;/g, 'const pct = (dashboard.todayTargetPence || 0) > 0 ? Math.floor((dashboard.todayEarningsPence / dashboard.todayTargetPence!) * 100) : 0;');

fs.writeFileSync('src/dashboard/Dashboard.tsx', file);
