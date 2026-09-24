const fs = require('fs');
let css = fs.readFileSync('src/map/v3-uber-overlay.css', 'utf8');

// Remove the previous append
css = css.replace(/\/\* Shift map elements up to prevent overlap[\s\S]*$/, '');

css += `
/* Shift map elements up to prevent overlap with the new taller 3-row progress footer */
.maplibregl-ctrl-bottom-right,
.maplibregl-ctrl-bottom-left {
  margin-bottom: 90px !important;
}

.drive-shell .location-card,
.drive-shell .active-route-panel {
  margin-bottom: 40px !important;
}

@media (max-width: 700px) and (orientation: portrait) {
  .drive-shell .zoom-controls {
    margin-bottom: 40px !important;
  }
}
`;

fs.writeFileSync('src/map/v3-uber-overlay.css', css);
