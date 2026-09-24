const fs = require('fs');
let css = fs.readFileSync('src/map/v3-uber-overlay.css', 'utf8');

css = css.replace(/\/\* Shift map elements up to prevent overlap[\s\S]*$/, '');

css += `
/* Shift map elements up by 45px to prevent overlap with the taller 3-row progress footer */
.maplibregl-ctrl-bottom-right,
.maplibregl-ctrl-bottom-left {
  margin-bottom: 90px !important;
}

.drive-shell .zoom-controls,
.drive-shell .drive-controls,
.drive-shell .location-card,
.drive-shell .active-route-panel {
  margin-bottom: 45px !important;
}
`;

fs.writeFileSync('src/map/v3-uber-overlay.css', css);
