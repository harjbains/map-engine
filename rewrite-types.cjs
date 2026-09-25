const fs = require('fs');

let file = fs.readFileSync('src/uber/types.ts', 'utf8');

file = file.replace(/weeklyForecastPence: Pence \| null;/, 'weeklyForecastPence: Pence | null;\n  provisionalForecast?: boolean;');

fs.writeFileSync('src/uber/types.ts', file);
