const fs = require('fs');
let c = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

c = c.replace(
  '£{Math.floor(shiftEarningsPence / 100)}',
  '{Math.floor(shiftEarningsPence / 100)}'
);

c = c.replace(
  '£{Math.floor(remainingTarget / 100)}',
  '{Math.floor(remainingTarget / 100)}'
);

c = c.replace(
  /<span style={{ fontSize: '9px', fontWeight: 800, color: mutedText, letterSpacing: '0\.2px' }}>TO TARGET<\/span>/g,
  ''
);

c = c.replace(
  /<>\s*<span style={{ fontSize: '22px', fontWeight: 900, color: targetColor, lineHeight: 1\.1 }}>\{Math\.floor\(remainingTarget \/ 100\)\}<\/span>\s*<\/>/g,
  '<span style={{ fontSize: \'22px\', fontWeight: 900, color: targetColor, lineHeight: 1.1 }}>{Math.floor(remainingTarget / 100)}</span>'
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', c);
console.log("Text removed successfully.");
