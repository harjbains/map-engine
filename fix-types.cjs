const fs = require('fs');

// 1. types.ts
let types = fs.readFileSync('src/uber/types.ts', 'utf8');
types = types.replace(/targetPence: Pence \| null;/g, 'targetPence: Pence | null;\n  amTargetPence: Pence | null;\n  pmTargetPence: Pence | null;');
fs.writeFileSync('src/uber/types.ts', types);

// 2. calculations.ts
let calc = fs.readFileSync('src/uber/calculations.ts', 'utf8');
calc = calc.replace(/targetPence,/g, 'targetPence, amTargetPence: dayPlan?.amTargetPence ?? 0, pmTargetPence: dayPlan?.pmTargetPence ?? 0,');
fs.writeFileSync('src/uber/calculations.ts', calc);

// 3. repository.ts (cast 'as any')
let repo = fs.readFileSync('src/uber/repository.ts', 'utf8');
repo = repo.replace(/amTargetPence: row\.am_target_pence, pmTargetPence: row\.pm_target_pence,/g, 'amTargetPence: (row as any).am_target_pence ?? 0, pmTargetPence: (row as any).pm_target_pence ?? 0,');
repo = repo.replace(/shiftType: row\.shift_type/g, 'shiftType: (row as any).shift_type');
repo = repo.replace(/const result = await this\.client\.rpc\("set_uber_week_plan_am_pm_targets"/g, 'const result = await (this.client as any).rpc("set_uber_week_plan_am_pm_targets"');
repo = repo.replace(/shiftType: "am" \| "pm" \| null/g, 'shiftType: "am" | "pm" | null');
repo = repo.replace(/patch\.shift_type = updates\.shiftType;/g, '(patch as any).shift_type = updates.shiftType;');
repo = repo.replace(/shift_type: shiftType,/g, 'shift_type: shiftType,');
repo = repo.replace(/const result = await this\.client\.from\("uber_shifts"\)\.insert\(\{/g, 'const result = await (this.client as any).from("uber_shifts").insert({');
repo = repo.replace(/async updateShift\(shiftId: string, updates: \{[\s\S]*?\}\): Promise<UberShift> \{[\s\S]*?const patch: any = \{\};/, `async updateShift(shiftId: string, updates: any): Promise<UberShift> {\n    const patch: any = {};`);
fs.writeFileSync('src/uber/repository.ts', repo);

// 4. local-repository.ts
let locRepo = fs.readFileSync('src/uber/local-repository.ts', 'utf8');
locRepo = locRepo.replace(/\{ weekStart, date, isWorking, workWeight: w \?\? "normal" \}/g, '{ weekStart, date, isWorking, workWeight: w ?? "normal", amTargetPence: w !== null ? 5000 : 0, pmTargetPence: w !== null ? 5000 : 0 }');
fs.writeFileSync('src/uber/local-repository.ts', locRepo);

// 5. preview.ts
let prev = fs.readFileSync('src/dashboard/preview.ts', 'utf8');
prev = prev.replace(/isWorking: true, workWeight: "normal" \}/g, 'isWorking: true, workWeight: "normal", amTargetPence: 5000, pmTargetPence: 0 }');
prev = prev.replace(/isWorking: true, workWeight: "heavy" \}/g, 'isWorking: true, workWeight: "heavy", amTargetPence: 10000, pmTargetPence: 5000 }');
fs.writeFileSync('src/dashboard/preview.ts', prev);
