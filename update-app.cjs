const fs = require('fs');

// src/map/V3UberOverlay.tsx
let overlay = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');
overlay = overlay.replace(
  /onSavePlan: \(weights: Array<WorkWeight \| null>\) => Promise<UberDashboard>;/g,
  `onSavePlan: (targetPence: number, weights: Array<WorkWeight | null>) => Promise<UberDashboard>;`
);
overlay = overlay.replace(
  /onSave=\{async \(weights\) => \{ await onSavePlan\(weights\);/g,
  `onSave={async (target, weights) => { await onSavePlan(target, weights);`
);
fs.writeFileSync('src/map/V3UberOverlay.tsx', overlay);

// src/App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(
  /const savePlan = useCallback\(async \(weights: Array<WorkWeight \| null>\) => \{\s*const refreshed = await service\.saveCurrentWeekWeights\(weights, dashboard\?\.today\);/g,
  `const savePlan = useCallback(async (targetPence: number, weights: Array<WorkWeight | null>) => {
    const refreshed = await service.saveCurrentWeekPlan(targetPence, weights, dashboard?.today);`
);
fs.writeFileSync('src/App.tsx', app);
