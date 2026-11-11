const fs = require('fs');
let css = fs.readFileSync('src/dashboard/uber-panels.css', 'utf8');

const newCSS = `
.uber-plan-target { padding: 16px; background: rgba(0,0,0,0.2); border-radius: 8px; margin: 10px 0; display: flex; align-items: center; justify-content: space-between; }
.uber-plan-target label { font-weight: 600; font-size: 0.9rem; color: #94a3b8; }
.uber-plan-target div { color: #53cfff; font-size: 1.4rem; font-weight: 700; }
.drive-shell:not(.dark) .uber-plan-target { background: #ffffff; border: 1px solid #a2c1d4; }
.drive-shell:not(.dark) .uber-plan-target label { color: #3f5866; }
.drive-shell:not(.dark) .uber-plan-target div { color: #0b6845; }
.uber-plan-am-pm-grid { display: flex; gap: 4px; overflow-x: auto; padding-bottom: 8px; }
.uber-plan-day-column { flex: 0 0 auto; width: 80px; display: flex; flex-direction: column; gap: 4px; }
.uber-plan-day-column > .day-name { text-align: center; font-size: 14px; font-weight: 600; color: #94a3b8; padding-bottom: 4px; }
.drive-shell:not(.dark) .uber-plan-day-column > .day-name { color: #3f5866; }
.shift-box { padding: 8px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(0, 0, 0, 0.15); cursor: pointer; text-align: center; height: 60px; display: flex; flex-direction: column; justify-content: center; transition: all 0.2s; }
.shift-box .shift-label { font-size: 10px; color: #94a3b8; font-weight: 600; }
.shift-box .shift-val { font-size: 16px; font-weight: 600; color: #475569; }
.shift-box.active { background: rgba(255, 255, 255, 0.05); }
.shift-box.active .shift-val { color: #fff; }
.shift-box.am.editing { background: rgba(83, 207, 255, 0.15); border-color: #53cfff; }
.shift-box.pm.editing { background: rgba(244, 114, 182, 0.15); border-color: #f472b6; }
.drive-shell:not(.dark) .shift-box { background: #ffffff; border-color: #cbd5e1; }
.drive-shell:not(.dark) .shift-box .shift-label { color: #64748b; }
.drive-shell:not(.dark) .shift-box .shift-val { color: #94a3b8; }
.drive-shell:not(.dark) .shift-box.active { background: #f0fdf4; border-color: #86efac; }
.drive-shell:not(.dark) .shift-box.active .shift-val { color: #166534; }
.drive-shell:not(.dark) .shift-box.am.editing { background: #e0f2fe; border-color: #0284c7; }
.drive-shell:not(.dark) .shift-box.pm.editing { background: #fdf4ff; border-color: #c026d3; }
.uber-plan-editor { background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 12px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; }
.uber-plan-editor button { background: rgba(255, 255, 255, 0.1); color: #fff; border: none; padding: 12px 20px; border-radius: 8px; font-size: 18px; font-weight: 700; cursor: pointer; }
.uber-plan-editor .editor-val { font-size: 24px; font-weight: 700; color: #fff; }
.drive-shell:not(.dark) .uber-plan-editor { background: #f8fafc; border: 1px solid #cbd5e1; }
.drive-shell:not(.dark) .uber-plan-editor button { background: #ffffff; border: 1px solid #a2c1d4; color: #206399; }
.drive-shell:not(.dark) .uber-plan-editor .editor-val { color: #0f172a; }
`;

if (!css.includes('.uber-plan-target')) {
  fs.writeFileSync('src/dashboard/uber-panels.css', css + newCSS);
}
