const fs = require('fs');
let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

if (!file.includes('{modal === "shifts" && <ShiftHistoryPanel')) {
  file = file.replace(
    '{modal === "plan" && <WeeklyPlanPanel',
    '{modal === "shifts" && <ShiftHistoryPanel darkMode={darkMode} dashboard={dashboard} onClose={() => setModal("dashboard")} />}\n        {modal === "plan" && <WeeklyPlanPanel'
  );
  fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
}
