const fs = require('fs');

let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

file = file.replace(
  /onSavePlan: \(weights: Array<WorkWeight \| null>\) => Promise<UberDashboard>;/g,
  `onSavePlan: (targetPence: number, weights: Array<WorkWeight | null>) => Promise<UberDashboard>;`
);

file = file.replace(
  /onSave=\{async \(weights\) => \{ await onSavePlan\(weights\); setModal\("closed"\); onChangeDate\?\.\(null\); \}\}/g,
  `onSave={async (targetPence, weights) => { await onSavePlan(targetPence, weights); setModal("closed"); onChangeDate?.(null); }}`
);

// If the first replace didn't work because of spacing or something, let's try a broader one:
file = file.replace(
  /onSavePlan:\s*\(weights:\s*Array<WorkWeight\s*\|\s*null>\)\s*=>\s*Promise<UberDashboard>;/g,
  `onSavePlan: (targetPence: number, weights: Array<WorkWeight | null>) => Promise<UberDashboard>;`
);

file = file.replace(
  /onSave=\{async\s*\(weights\)\s*=>\s*\{\s*await\s*onSavePlan\(weights\);\s*setModal\("closed"\);\s*onChangeDate\?\.\(null\);\s*\}\}/g,
  `onSave={async (targetPence, weights) => { await onSavePlan(targetPence, weights); setModal("closed"); onChangeDate?.(null); }}`
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
