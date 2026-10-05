const fs = require('fs');

let sw = fs.readFileSync('public/sw.js', 'utf8');
sw = sw.replace(/const SHELL_CACHE = "map-engine-shell-v\d+";/, 'const SHELL_CACHE = "map-engine-shell-v3-3-0";');
fs.writeFileSync('public/sw.js', sw);
