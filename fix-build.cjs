const fs = require('fs');

// 1. Fix types.ts
let types = fs.readFileSync('src/uber/types.ts', 'utf8');
types = types.replace(/  amTargetPence: Pence;\n  pmTargetPence: Pence;\n/g, ''); // remove the non-nullable ones
fs.writeFileSync('src/uber/types.ts', types);

// 2. Fix repository.ts
let repo = fs.readFileSync('src/uber/repository.ts', 'utf8');
repo = repo.replace(/return throwOnError\(result\)\.map\(planDayFromRow\);/, `if (result.error) throw new Error(result.error.message); return (result.data ?? []).map(planDayFromRow);`);
fs.writeFileSync('src/uber/repository.ts', repo);

// 3. Fix tests
let testFile = fs.readFileSync('tests/calculations.test.ts', 'utf8');
testFile = testFile.replace(/workWeight: WorkWeight;/g, 'workWeight: WorkWeight; amTargetPence: number; pmTargetPence: number;');
testFile = testFile.replace(/w as WorkWeight\)/g, 'w as WorkWeight, amTargetPence: 0, pmTargetPence: 0)');
fs.writeFileSync('tests/calculations.test.ts', testFile);
