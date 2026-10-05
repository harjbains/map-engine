const fs = require('fs');
let file = fs.readFileSync('src/dashboard/Dashboard.tsx', 'utf8');

file = file.replace(/onPlan\?: \(\) => void;/, 'onPlan?: () => void; onShifts?: () => void;');
file = file.replace(/onPlan, onUpdateHistoricalDay/, 'onPlan, onShifts, onUpdateHistoricalDay');

const buttons = `
      <nav className="uber-dashboard-actions" aria-label="Uber actions">
        {onUpdate && <button type="button" onClick={onUpdate}>UPDATE EARNINGS</button>}
        {onMileage && <button type="button" onClick={onMileage}>BUSINESS MILES</button>}
        {onPlan && <button type="button" onClick={onPlan}>WEEKLY PLAN</button>}
        {onShifts && <button type="button" onClick={onShifts}>SHIFT HISTORY</button>}
      </nav>
`;

file = file.replace(/<nav className="uber-dashboard-actions".*?<\/nav>/s, buttons);

fs.writeFileSync('src/dashboard/Dashboard.tsx', file);
