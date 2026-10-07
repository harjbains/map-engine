const fs = require('fs');

let config = fs.readFileSync('src/ported-map/map-engine/config.ts', 'utf8');
config = config.replace(/APP_VERSION = "v3\.3\.4"/, 'APP_VERSION = "v3.3.5"');
fs.writeFileSync('src/ported-map/map-engine/config.ts', config);

let sw = fs.readFileSync('public/sw.js', 'utf8');
sw = sw.replace(/map-engine-shell-v3-3-4/, 'map-engine-shell-v3-3-5');
fs.writeFileSync('public/sw.js', sw);

let wp = fs.readFileSync('src/dashboard/WeeklyPlanPanel.tsx', 'utf8');
wp = wp.replace(/MAP-ENGINE V3\.3\.4/, 'MAP-ENGINE V3.3.5');
fs.writeFileSync('src/dashboard/WeeklyPlanPanel.tsx', wp);

let cl = fs.readFileSync('src/dashboard/ChangelogModal.tsx', 'utf8');
cl = cl.replace(/<h1>v3\.3\.4 Updates<\/h1>/, '<h1>v3.3.5 Updates</h1>');
fs.writeFileSync('src/dashboard/ChangelogModal.tsx', cl);
