const fs = require('fs');
let file = fs.readFileSync('src/ported-map/MapEngine.tsx', 'utf8');

file = file.replace(
  /onSavePlan: \(weights: Array<WorkWeight \| null>\) => Promise<UberDashboard>;/g,
  `onSavePlan: (targetPence: number, weights: Array<WorkWeight | null>) => Promise<UberDashboard>;`
);

fs.writeFileSync('src/ported-map/MapEngine.tsx', file);
