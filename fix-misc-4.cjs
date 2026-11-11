const fs = require('fs');

let f = fs.readFileSync('tests/calculations.test.ts', 'utf8');
f = f.replace(/createdAt: "", updatedAt: "" }\);/g, 'amTargetPence: 0, pmTargetPence: 0, createdAt: "", updatedAt: "" });');
fs.writeFileSync('tests/calculations.test.ts', f);

let f2 = fs.readFileSync('src/uber/local-repository.ts', 'utf8');
f2 = f2.replace(/createdAt: "", updatedAt: "" }/g, 'amTargetPence: 0, pmTargetPence: 0, createdAt: "", updatedAt: "" }');
fs.writeFileSync('src/uber/local-repository.ts', f2);

let f3 = fs.readFileSync('src/uber/calculations.ts', 'utf8');
f3 = f3.replace(/targetPence: dayPlan\?\.isWorking \? \(dailyTargets\.get\(date\) \?\? null\) : null,/g, 'targetPence: dayPlan?.isWorking ? (dailyTargets.get(date) ?? null) : null, amTargetPence: dayPlan?.amTargetPence ?? null, pmTargetPence: dayPlan?.pmTargetPence ?? null,');
fs.writeFileSync('src/uber/calculations.ts', f3);
