const fs = require('fs');
let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

file = file.replace(/import \{ WeeklyPlanPanel \} from "\.\.\/dashboard\/WeeklyPlanPanel\.js";/, 'import { WeeklyPlanPanel } from "../dashboard/WeeklyPlanPanel.js";\nimport { ShiftHistoryPanel } from "../dashboard/ShiftHistoryPanel.js";');

file = file.replace(/const \[modal, setModal\] = useState<"closed" \| "dashboard" \| "editor" \| "mileage" \| "plan" \| "history" \| "changelog">\("closed"\);/, 
'const [modal, setModal] = useState<"closed" | "dashboard" | "editor" | "mileage" | "plan" | "history" | "changelog" | "shifts">("closed");');

file = file.replace(/onPlan=\{.*?\} onUpdateHistoricalDay=/, 'onPlan={() => setModal("plan")} onShifts={() => setModal("shifts")} onUpdateHistoricalDay=');

const panel = `
        {modal === "plan" && <WeeklyPlanPanel dashboard={dashboard} onCancel={() => setModal("dashboard")} onSave={async (targetPence, weights) => { await onSavePlan(targetPence, weights); setModal("closed"); onChangeDate?.(null); }} />}
        {modal === "shifts" && <ShiftHistoryPanel dashboard={dashboard} darkMode={darkMode} onClose={() => setModal("dashboard")} />}
`;
file = file.replace(/\{modal === "plan".*?\/\}/s, panel);

fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
