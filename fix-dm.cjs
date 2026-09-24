const fs = require('fs');
let c = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

c = c.replace(
  '<DailyEarningsPanel key={dashboard.today} dashboard={dashboard}',
  '<DailyEarningsPanel darkMode={darkMode} key={dashboard.today} dashboard={dashboard}'
);

c = c.replace(
  '<MileagePanel key={dashboard.today} dashboard={dashboard}',
  '<MileagePanel darkMode={darkMode} key={dashboard.today} dashboard={dashboard}'
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', c);
