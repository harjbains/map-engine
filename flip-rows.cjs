const fs = require('fs');
let c = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

const middleSquaresRegex = /\{\/\* MIDDLE: SQUARES \*\/\}[\s\S]*?\{\/\* RIGHT-MIDDLE: TARGET \*\/\}/;

const flippedMiddleSquares = `{/* MIDDLE: SQUARES */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden', padding: '2px 0' }}>
              {/* TOP ROW (£5 shift target) */}
              <div className={isFinal25 ? 'final-25-glow' : ''} style={{ display: 'flex', gap: '2px', height: '14px' }}>
                {totalBottomSquares > 0 ? Array.from({length: totalBottomSquares}).map((_, i) => (
                  <div key={'bot-'+i} style={{ flex: 1, height: '100%', backgroundColor: i < filledBottomSquares ? filledColor : emptyColor, border: sqBorder, borderRadius: '3px', transition: 'background-color 0.3s' }} />
                )) : (
                  <div style={{ flex: 1, height: '100%', backgroundColor: emptyColor, border: sqBorder, borderRadius: '3px' }} />
                )}
              </div>
              
              {/* BOTTOM ROW (£1 current block) */}
              <div className={isFinal25 ? 'final-25-glow' : ''} style={{ display: 'flex', gap: '2px', height: '10px' }}>
                {Array.from({length: 25}).map((_, i) => (
                  <div key={'top-'+i} style={{ flex: 1, height: '100%', backgroundColor: i < topSquares ? filledColor : emptyColor, border: sqBorder, borderRadius: '2px', transition: 'background-color 0.3s' }} />
                ))}
              </div>
            </div>
            
            {/* RIGHT-MIDDLE: TARGET */}`;

c = c.replace(middleSquaresRegex, flippedMiddleSquares);
fs.writeFileSync('src/map/V3UberOverlay.tsx', c);
console.log("Flipped rows applied.");
