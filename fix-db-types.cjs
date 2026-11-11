const fs = require('fs');
let db = fs.readFileSync('src/supabase/database.types.ts', 'utf8');

db = db.replace(/work_weight: Database\["public"\]\["Enums"\]\["uber_plan_day_weight"\]/g, 'work_weight: Database["public"]["Enums"]["uber_plan_day_weight"]; am_target_pence: number; pm_target_pence: number');

db = db.replace(/end_earnings_pence: number \| null/g, 'end_earnings_pence: number | null; shift_type: "am" | "pm" | null');

db = db.replace(/"set_uber_week_plan_weights": {[\s\S]*?}/, `"set_uber_week_plan_am_pm_targets": { Args: { p_week_start: string; p_am_targets: number[]; p_pm_targets: number[] }; Returns: { owner_id: string; week_start: string; date: string; is_working: boolean; work_weight: Database["public"]["Enums"]["uber_plan_day_weight"]; created_at: string; updated_at: string; am_target_pence: number; pm_target_pence: number }[] }`);

fs.writeFileSync('src/supabase/database.types.ts', db);
