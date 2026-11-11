const fs = require('fs');

const localRepoFile = 'src/uber/local-repository.ts';
let local = fs.readFileSync(localRepoFile, 'utf8');
local = local.replace(/workWeight: "normal",\n        createdAt/g, 'workWeight: "normal",\n        amTargetPence: 5000,\n        pmTargetPence: 5000,\n        createdAt');
local = local.replace(/isWorking,\n          workWeight,\n          createdAt/g, 'isWorking,\n          workWeight,\n          amTargetPence: isWorking ? 5000 : 0,\n          pmTargetPence: isWorking ? 5000 : 0,\n          createdAt');
fs.writeFileSync(localRepoFile, local);

const calcFile = 'src/uber/calculations.ts';
let calc = fs.readFileSync(calcFile, 'utf8');
calc = calc.replace(/targetPence: Pence \| null;/g, 'targetPence: Pence | null;\n  amTargetPence: Pence | null;\n  pmTargetPence: Pence | null;');
calc = calc.replace(/const targetPence = dayPlan\?\.isWorking \? \(targetByDate\.get\(date\) \?\? null\) : null;/g, 'const targetPence = dayPlan?.isWorking ? (targetByDate.get(date) ?? null) : null;\n    const amTargetPence = dayPlan?.amTargetPence ?? 0;\n    const pmTargetPence = dayPlan?.pmTargetPence ?? 0;');
calc = calc.replace(/actualMilesTenths: record\?\.businessMilesTenths \?\? null,\n        targetPence,\n        status/g, 'actualMilesTenths: record?.businessMilesTenths ?? null,\n        targetPence,\n        amTargetPence,\n        pmTargetPence,\n        status');
fs.writeFileSync(calcFile, calc);
