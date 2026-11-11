const fs = require('fs');
let p = fs.readFileSync('src/uber/local-repository.ts', 'utf8');
p = p.replace(/workWeight: "normal",\n        createdAt/g, 'workWeight: "normal",\n        amTargetPence: 5000,\n        pmTargetPence: 5000,\n        createdAt');
p = p.replace(/workWeight,\n          createdAt/g, 'workWeight,\n          amTargetPence: isWorking ? 5000 : 0,\n          pmTargetPence: isWorking ? 5000 : 0,\n          createdAt');
fs.writeFileSync('src/uber/local-repository.ts', p);
