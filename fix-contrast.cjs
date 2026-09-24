const fs = require('fs');
let css = fs.readFileSync('src/map/v3-uber-overlay.css', 'utf8');

css += `
/* Ensure the footer stands out clearly against the dark map */
.drive-shell.dark .uber-session-footer {
  background: #1e293b !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
}
`;

fs.writeFileSync('src/map/v3-uber-overlay.css', css);
