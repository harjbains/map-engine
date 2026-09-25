const fs = require('fs');

let file = fs.readFileSync('src/uber/service.ts', 'utf8');

file = file.replace(/calculateWeeklyForecast\(summary, sessions, planDays, records, today\)/, 'calculateWeeklyForecast(summary, planDays, records, today)');

// Add provisionalForecast to the returned dashboard object
file = file.replace(/weeklyForecastPence: forecast\.amount,/, 'weeklyForecastPence: forecast.amount,\n      provisionalForecast: forecast.provisional,');

fs.writeFileSync('src/uber/service.ts', file);
