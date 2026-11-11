const fs = require('fs');

// preview.ts
let prev = fs.readFileSync('src/dashboard/preview.ts', 'utf8');
prev = prev.replace(/isWorking: true, workWeight: index === 1 \|\| index === 6 \? "light" : index === 4 \|\| index === 5 \? "heavy" : "normal", createdAt: "", updatedAt: "" \}\)\);/g, 'isWorking: true, workWeight: index === 1 || index === 6 ? "light" : index === 4 || index === 5 ? "heavy" : "normal", amTargetPence: 5000, pmTargetPence: 0, createdAt: "", updatedAt: "" }));');
fs.writeFileSync('src/dashboard/preview.ts', prev);

// local-repository.ts
let locRepo = fs.readFileSync('src/uber/local-repository.ts', 'utf8');
locRepo = locRepo.replace(/\{ weekStart, date, isWorking, workWeight: w \?\? "normal" \}/g, '{ weekStart, date, isWorking, workWeight: w ?? "normal", amTargetPence: w !== null ? 5000 : 0, pmTargetPence: w !== null ? 5000 : 0 }');
locRepo = locRepo.replace(/workWeight: "normal", createdAt/g, 'workWeight: "normal", amTargetPence: 5000, pmTargetPence: 0, createdAt');
locRepo = locRepo.replace(/workWeight: w, createdAt/g, 'workWeight: w, amTargetPence: 0, pmTargetPence: 0, createdAt');
fs.writeFileSync('src/uber/local-repository.ts', locRepo);

// calculations.test.ts
let calcTest = fs.readFileSync('tests/calculations.test.ts', 'utf8');
calcTest = calcTest.replace(/w as WorkWeight\), createdAt/g, 'w as WorkWeight, amTargetPence: 0, pmTargetPence: 0), createdAt');
fs.writeFileSync('tests/calculations.test.ts', calcTest);

// calculations.ts
let calc = fs.readFileSync('src/uber/calculations.ts', 'utf8');
calc = calc.replace(/targetPence: number \| null;/g, 'targetPence: number | null; amTargetPence: number | null; pmTargetPence: number | null;');
calc = calc.replace(/const targetPence = dayPlan\?\.isWorking \? \(dailyTargets\.get\(date\) \?\? null\) : null;/g, 'const targetPence = dayPlan?.isWorking ? (dailyTargets.get(date) ?? null) : null;\n    const amTargetPence = dayPlan?.amTargetPence ?? 0;\n    const pmTargetPence = dayPlan?.pmTargetPence ?? 0;');
calc = calc.replace(/targetPence, status/g, 'targetPence, amTargetPence, pmTargetPence, status');
fs.writeFileSync('src/uber/calculations.ts', calc);
