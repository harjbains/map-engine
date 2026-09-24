const fs = require('fs');
let c = fs.readFileSync('src/dashboard/DailyEarningsPanel.tsx', 'utf8');
c = c.replace('onSave: (previewPence: number) => Promise<void> }', 'onSave: (previewPence: number) => Promise<void>; darkMode?: boolean }');
c = c.replace('export function DailyEarningsPanel({ dashboard, onCancel, onSave }:', 'export function DailyEarningsPanel({ dashboard, onCancel, onSave, darkMode }:');
c = c.replace('<div className="v2-earnings-modal">', '<div className={`v2-earnings-modal ${darkMode ? "dark" : ""}`}>');
fs.writeFileSync('src/dashboard/DailyEarningsPanel.tsx', c);

let m = fs.readFileSync('src/dashboard/MileagePanel.tsx', 'utf8');
m = m.replace('onSave: (milesTenths: number) => Promise<void> }', 'onSave: (milesTenths: number) => Promise<void>; darkMode?: boolean }');
m = m.replace('export function MileagePanel({ dashboard, onCancel, onSave }:', 'export function MileagePanel({ dashboard, onCancel, onSave, darkMode }:');
m = m.replace('<div className="v2-earnings-modal">', '<div className={`v2-earnings-modal ${darkMode ? "dark" : ""}`}>');
fs.writeFileSync('src/dashboard/MileagePanel.tsx', m);
