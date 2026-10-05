const fs = require('fs');

let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// 1. Remove import
file = file.replace(
  /import \{ MilestoneCelebration \} from "\.\/MilestoneCelebration\.js";\n/g,
  ''
);

// 2. Remove MilestoneCelebration component
file = file.replace(
  /<MilestoneCelebration transition=\{activeTransition\} onComplete=\{\(\) => setActiveTransition\(null\)\} \/>\n/g,
  ''
);

// 3. Change 3 zones to 2 zones
file = file.replace(
  /\{\/\* 3 Clickable Zones \*\/\}\s*<div style=\{\{ position: 'absolute', inset: 0, display: 'flex', zIndex: 10, borderRadius: '12px', overflow: 'hidden' \}\}>\s*<button\s*type="button"\s*onClick=\{\(\) => \{ setReturnTo\("closed"\); setModal\("dashboard"\); \}\}\s*style=\{\{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' \}\}\s*aria-label="Open Dashboard"\s*\/>\s*<button\s*type="button"\s*onClick=\{\(\) => \{ setReturnTo\("closed"\); setModal\("editor"\); \}\}\s*style=\{\{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' \}\}\s*aria-label="Update earnings"\s*\/>\s*<button\s*type="button"\s*onClick=\{\(\) => setActiveTransition\([^)]+\)\}\s*style=\{\{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' \}\}\s*aria-label="Display tiles"\s*\/>\s*<\/div>/g,
  `{/* 2 Clickable Zones */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 10, borderRadius: '12px', overflow: 'hidden' }}>
          <button 
            type="button" 
            onClick={() => { setReturnTo("closed"); setModal("dashboard"); }} 
            style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }}
            aria-label="Open Dashboard"
          />
          <button 
            type="button" 
            onClick={() => { setReturnTo("closed"); setModal("editor"); }} 
            style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }}
            aria-label="Update earnings"
          />
        </div>`
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
