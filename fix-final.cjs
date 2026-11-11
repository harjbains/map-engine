const fs = require('fs');
let p = fs.readFileSync('src/dashboard/preview.ts', 'utf8');
p = p.replace(/workWeight: index === 1 \|\| index === 6 \? "light" : index === 4 \|\| index === 5 \? "heavy" : "normal", createdAt: "", updatedAt: ""/g, 'workWeight: index === 1 || index === 6 ? "light" : index === 4 || index === 5 ? "heavy" : "normal", amTargetPence: 5000, pmTargetPence: 5000, createdAt: "", updatedAt: ""');
fs.writeFileSync('src/dashboard/preview.ts', p);

let t = fs.readFileSync('tests/calculations.test.ts', 'utf8');
t = t.replace(/workWeight, createdAt: "", updatedAt: ""/g, 'workWeight, amTargetPence: 0, pmTargetPence: 0, createdAt: "", updatedAt: ""');
fs.writeFileSync('tests/calculations.test.ts', t);

let l = fs.readFileSync('src/uber/local-repository.ts', 'utf8');
l = l.replace(/workWeight: "normal",\n        createdAt: now/g, 'workWeight: "normal",\n        amTargetPence: 0,\n        pmTargetPence: 0,\n        createdAt: now');
l = l.replace(/workWeight,\n          createdAt: existing\?\.createdAt \?\? now,/g, 'workWeight,\n          amTargetPence: 0,\n          pmTargetPence: 0,\n          createdAt: existing?.createdAt ?? now,');
fs.writeFileSync('src/uber/local-repository.ts', l);
