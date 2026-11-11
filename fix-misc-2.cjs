const fs = require('fs');

// preview.ts
let prev = fs.readFileSync('src/dashboard/preview.ts', 'utf8');
prev = prev.replace(/createdAt: "",/g, 'amTargetPence: 5000, pmTargetPence: 5000, createdAt: "",');
fs.writeFileSync('src/dashboard/preview.ts', prev);

// local-repository.ts
let locRepo = fs.readFileSync('src/uber/local-repository.ts', 'utf8');
locRepo = locRepo.replace(/createdAt: "",/g, 'amTargetPence: 5000, pmTargetPence: 5000, createdAt: "",');
fs.writeFileSync('src/uber/local-repository.ts', locRepo);

// calculations.test.ts
let calcTest = fs.readFileSync('tests/calculations.test.ts', 'utf8');
calcTest = calcTest.replace(/createdAt: "",/g, 'amTargetPence: 0, pmTargetPence: 0, createdAt: "",');
fs.writeFileSync('tests/calculations.test.ts', calcTest);

// calculations.ts
let calc = fs.readFileSync('src/uber/calculations.ts', 'utf8');
calc = calc.replace(/targetPence: number \| null;/, 'targetPence: number | null;\n      amTargetPence: number | null;\n      pmTargetPence: number | null;');
calc = calc.replace(/targetPence,/g, 'targetPence, amTargetPence: dayPlan?.amTargetPence ?? 0, pmTargetPence: dayPlan?.pmTargetPence ?? 0,');
fs.writeFileSync('src/uber/calculations.ts', calc);
