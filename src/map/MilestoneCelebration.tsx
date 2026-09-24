import { useEffect, useState } from 'react';
import type { EarningsTransition } from '../uber/milestones.js';
import './celebration.css';

const SQAURE_COLORS = ["#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#eab308", "#ef4444"];

export function MilestoneCelebration({
  transition,
  onComplete,
}: {
  transition: EarningsTransition | null;
  onComplete?: () => void;
}) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!transition) return;
    setFading(false);

    // Calculate level/board based on newSquares
    const level = Math.max(1, Math.ceil(transition.newSquares / 25));
    const startSquare = (level - 1) * 25;
    
    // Only calculate squaresToAdd for the squares appearing on the CURRENT board.
    // If they jumped from 24 to 27, the board is level 2 (squares 26-50), 
    // so the ones popping here are just 26 and 27 (2 squares).
    const poppingOnThisBoard = Math.max(0, transition.newSquares - Math.max(startSquare, transition.oldSquares));
    
    const staggerDelay = Math.max(150, Math.min(500, 2000 / (poppingOnThisBoard || 1)));
    const totalAnimationTime = (poppingOnThisBoard * staggerDelay) + 1000;
    
    const fadeTimer = window.setTimeout(() => setFading(true), totalAnimationTime);
    const finishTimer = window.setTimeout(() => onComplete?.(), totalAnimationTime + 500);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(finishTimer);
    };
  }, [transition, onComplete]);

  if (!transition) return null;

  const level = Math.max(1, Math.ceil(transition.newSquares / 25));
  const startSquare = (level - 1) * 25;
  const poppingOnThisBoard = Math.max(0, transition.newSquares - Math.max(startSquare, transition.oldSquares));
  const staggerDelay = Math.max(150, Math.min(500, 2000 / (poppingOnThisBoard || 1)));

  return (
    <div
      className={`ride-squares-overlay ${fading ? 'fade-out' : ''}`}
      role='status'
      aria-live='polite'
      onClick={() => onComplete?.()}
    >
      <div className="ride-squares-container" onClick={(e) => e.stopPropagation()}>
        <h2>Daily Target Progress</h2>
        
        {level > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {Array.from({ length: level }, (_, i) => (
              <div key={i} style={{ 
                padding: "2px 10px", 
                background: i + 1 === level ? "#3b82f6" : "#10b981", 
                borderRadius: "12px", 
                fontSize: "0.85rem", 
                fontWeight: "bold",
                color: "#fff",
                boxShadow: i + 1 === level ? "0 0 10px rgba(59, 130, 246, 0.5)" : "none"
              }}>
                {i + 1 === level ? `Board ${i + 1}` : `Board ${i + 1} ✓`}
              </div>
            ))}
          </div>
        )}

        <div className="ride-squares-grid">
          {Array.from({ length: 25 }, (_, i) => {
            const num = startSquare + i + 1;
            const isAlreadyFilled = num <= transition.oldSquares;
            const isNew = num > transition.oldSquares && num <= transition.newSquares;
            
            // Loop the colors so it naturally cycles if they go way past 30 squares
            const colorIndex = Math.floor((num - 1) / 5) % SQAURE_COLORS.length;
            const color = SQAURE_COLORS[colorIndex];
            
            const indexOnBoard = num - Math.max(startSquare + 1, transition.oldSquares + 1);
            const delaySec = isNew ? (indexOnBoard * (staggerDelay / 1000)) : 0;
            
            return (
              <div 
                key={num} 
                className={`ride-square ${isAlreadyFilled ? 'filled' : ''}`}
                style={isAlreadyFilled ? { 
                  '--sq-color': color, 
                  background: color, 
                  borderColor: color,
                  boxShadow: `0 0 15px ${color}66`
                } as React.CSSProperties : { '--sq-color': color } as React.CSSProperties}
              >
                {!isNew && num}
                
                {isNew && (
                  <div className="new-fill" style={{ animationDelay: `${delaySec}s` }}>
                    {num}
                    <div className="stars-burst" style={{ animationDelay: `${delaySec + 0.1}s` }}>✨</div>
                    <div className="stars-burst" style={{ animationDelay: `${delaySec + 0.2}s`, transform: 'scale(1.5)' }}>⭐</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="ride-squares-text">£{transition.newSquares * 5} earned today in Ride Squares!</p>
      </div>
    </div>
  );
}
