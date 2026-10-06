const fs = require('fs');

let dashboard = fs.readFileSync('src/dashboard/Dashboard.tsx', 'utf8');

dashboard = dashboard.replace(
  /const d = new Date\(dashboard\.today \+ "T12:00:00Z"\);\s*d\.setUTCDate\(d\.getUTCDate\(\) - 7\);/g,
  `const d = new Date(dashboard.summary.weekStart + "T12:00:00Z");\n                d.setUTCDate(d.getUTCDate() - 7);`
);

dashboard = dashboard.replace(
  /const d = new Date\(dashboard\.today \+ "T12:00:00Z"\);\s*d\.setUTCDate\(d\.getUTCDate\(\) \+ 7\);/g,
  `const d = new Date(dashboard.summary.weekStart + "T12:00:00Z");\n                d.setUTCDate(d.getUTCDate() + 7);`
);

fs.writeFileSync('src/dashboard/Dashboard.tsx', dashboard);
