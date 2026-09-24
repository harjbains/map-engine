const fs = require('fs');
let css = fs.readFileSync('src/map/v3-uber-overlay.css', 'utf8');

// replace the previous light mode rule
css = css.replace(/\.drive-shell:not\(\.dark\) \.uber-session-footer \{[\s\S]*?\}/, `.drive-shell:not(.dark) .uber-session-footer {
  background: #f0f9ff !important;
  box-shadow: 0 10px 30px rgba(49, 121, 185, 0.15);
  border: 1px solid #bae6fd;
}`);

fs.writeFileSync('src/map/v3-uber-overlay.css', css);
