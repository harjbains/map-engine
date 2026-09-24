const fs = require('fs');
let css = fs.readFileSync('src/map/v3-uber-overlay.css', 'utf8');

css += `
/* Light mode softer background for the footer */
.drive-shell:not(.dark) .uber-session-footer {
  background: #ffffff !important;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(0, 0, 0, 0.08);
}
`;

fs.writeFileSync('src/map/v3-uber-overlay.css', css);
