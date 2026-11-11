const fs = require('fs');
let c = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

c = c.replace(
  /onSavePlan: \(targetPence: number, weights: Array<WorkWeight \| null>\) => Promise<UberDashboard>;/g,
  'onSavePlan: (amTargets: number[], pmTargets: number[]) => Promise<UberDashboard>;'
);

c = c.replace(
  /onSave={async \(targetPence, weights\) => \{ await onSavePlan\(targetPence, weights\); setModal\("closed"\); onChangeDate\?\.\(null\); \}\}/g,
  'onSave={async (amTargets, pmTargets) => { await onSavePlan(amTargets, pmTargets); setModal("closed"); onChangeDate?.(null); }}'
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', c);
console.log("V3UberOverlay Props REALLY updated!");
