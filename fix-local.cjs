const fs = require('fs');

// local-repository.ts
let locRepo = fs.readFileSync('src/uber/local-repository.ts', 'utf8');
locRepo = locRepo.replace(/isWorking: workingDays\[idx\] \?\? false,\n      workWeight: "normal",/g, 'isWorking: workingDays[idx] ?? false,\n      workWeight: "normal", amTargetPence: 0, pmTargetPence: 0,');
locRepo = locRepo.replace(/isWorking: true,\n      workWeight: "normal",/g, 'isWorking: true,\n      workWeight: "normal", amTargetPence: 5000, pmTargetPence: 5000,');
locRepo = locRepo.replace(/isWorking,\n        workWeight,\n        createdAt/g, 'isWorking,\n        workWeight, amTargetPence: isWorking ? 5000 : 0, pmTargetPence: isWorking ? 5000 : 0,\n        createdAt');
fs.writeFileSync('src/uber/local-repository.ts', locRepo);

// preview.ts
let prev = fs.readFileSync('src/dashboard/preview.ts', 'utf8');
prev = prev.replace(/isWorking: true, workWeight: (.*?)createdAt/g, 'isWorking: true, workWeight: $1 amTargetPence: 5000, pmTargetPence: 5000, createdAt');
fs.writeFileSync('src/dashboard/preview.ts', prev);

// calculations.test.ts
let calcTest = fs.readFileSync('tests/calculations.test.ts', 'utf8');
calcTest = calcTest.replace(/w as WorkWeight\), amTargetPence: 0, pmTargetPence: 0\), createdAt/g, 'w as WorkWeight, amTargetPence: 0, pmTargetPence: 0, createdAt');
calcTest = calcTest.replace(/amTargetPence: 0, pmTargetPence: 0, amTargetPence: 0, pmTargetPence: 0, createdAt: "", updatedAt: ""/g, 'amTargetPence: 0, pmTargetPence: 0, createdAt: "", updatedAt: ""');
calcTest = calcTest.replace(/amTargetPence: 0, pmTargetPence: 0, createdAt: "", updatedAt: "" }\);/g, 'createdAt: "", updatedAt: "" });'); // oops, we'll fix later
calcTest = calcTest.replace(/businessMilesTenths, trips: 1, status: "completed", amTargetPence: 0, pmTargetPence: 0, createdAt: "", updatedAt: ""/g, 'businessMilesTenths, trips: 1, status: "completed", createdAt: "", updatedAt: ""');
fs.writeFileSync('tests/calculations.test.ts', calcTest);

