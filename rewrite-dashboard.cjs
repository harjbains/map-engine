const fs = require('fs');

let file = fs.readFileSync('src/dashboard/Dashboard.tsx', 'utf8');

// Replace the Metric for FORECAST
const oldMetric = `<Metric icon="🔮" label="FORECAST" value={gbp(dashboard.weeklyForecastPence || 0)} detail={<span style={{ color: (dashboard.forecastBand || 'grey') === 'gold' ? '#eab308' : (dashboard.forecastBand || 'grey') === 'teal' ? '#06b6d4' : '#64748b', fontWeight: 'bold' }}>Band: {(dashboard.forecastBand || 'grey').toUpperCase()}</span>} />`;
const newMetric = `<Metric icon="🔮" label="FORECAST" value={gbp(dashboard.weeklyForecastPence || 0)} detail={<span style={{ color: (dashboard.forecastBand || 'grey') === 'gold' ? '#eab308' : (dashboard.forecastBand || 'grey') === 'teal' ? '#06b6d4' : '#64748b', fontWeight: 'bold' }}>Band: {(dashboard.forecastBand || 'grey').toUpperCase()}{dashboard.provisionalForecast ? " (Provisional)" : ""}</span>} />`;

file = file.replace(oldMetric, newMetric);

fs.writeFileSync('src/dashboard/Dashboard.tsx', file);
