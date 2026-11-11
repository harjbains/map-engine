const fs = require('fs');

let me = fs.readFileSync('src/ported-map/MapEngine.tsx', 'utf8');

me = me.replace(/onSavePlan: \(targetPence: number, weights: Array<WorkWeight \| null>\) => Promise<UberDashboard>;/, `onSavePlan: (amTargets: number[], pmTargets: number[]) => Promise<UberDashboard>;`);
me = me.replace(/onStartShift: \(startEarnings: number\) => Promise<UberDashboard>;/, `onStartShift: (shiftType: 'am' | 'pm', startEarnings: number) => Promise<UberDashboard>;`);

fs.writeFileSync('src/ported-map/MapEngine.tsx', me);
