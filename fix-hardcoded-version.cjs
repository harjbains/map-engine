const fs = require('fs');

let config = fs.readFileSync('src/ported-map/map-engine/config.ts', 'utf8');
config = config.replace(/APP_VERSION = "v3\.1\.2"/, 'APP_VERSION = "v3.3.0"');
fs.writeFileSync('src/ported-map/map-engine/config.ts', config);

let wp = fs.readFileSync('src/dashboard/WeeklyPlanPanel.tsx', 'utf8');
wp = wp.replace(/MAP-ENGINE V3\.1\.2/, 'MAP-ENGINE V3.3.0');
fs.writeFileSync('src/dashboard/WeeklyPlanPanel.tsx', wp);

