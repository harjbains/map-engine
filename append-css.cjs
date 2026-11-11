const fs = require('fs');
let css = fs.readFileSync('src/dashboard/uber-panels.css', 'utf8');
const append = `

/* AM ACTIVE (BLUE) */
.drive-shell:not(.dark) .shift-box.am.active { background: #deebf5; border-color: #a2c1d4; }
.drive-shell:not(.dark) .shift-box.am.active .shift-val { color: #206399; }

/* PM ACTIVE (GREEN) */
.drive-shell:not(.dark) .shift-box.pm.active { background: #d3f3e8; border-color: #009368; }
.drive-shell:not(.dark) .shift-box.pm.active .shift-val { color: #006648; }

/* CURRENT SELECTION / EDITING (PASTEL PINK) */
.drive-shell:not(.dark) .shift-box.editing {
  background: #fdf2f8 !important;
  border-color: #f472b6 !important;
}
.drive-shell:not(.dark) .shift-box.editing .shift-val {
  color: #db2777 !important;
}
`;
fs.writeFileSync('src/dashboard/uber-panels.css', css + append);
