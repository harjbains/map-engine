const fs = require('fs');
let c = fs.readFileSync('src/ported-map/MapEngine.tsx', 'utf8');

c = c.replace(
  'onSavePlan: (targetPence: number, weights: (WorkWeight | null)[]) => Promise<UberDashboard>;',
  'onSavePlan: (amTargets: number[], pmTargets: number[]) => Promise<UberDashboard>;'
);

fs.writeFileSync('src/ported-map/MapEngine.tsx', c);
console.log("MapEngine Props updated!");
