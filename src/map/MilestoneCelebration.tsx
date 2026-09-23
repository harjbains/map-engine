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

    const squaresToAdd = transition.newSquares - transition.oldSquares;
    
    // Each square pops with a 0.5s delay. We cap the max staggered delay so we aren't waiting forever.
    const staggerDelay = Math.max(150, Math.min(500, 2000 / (squaresToAdd || 1)));
    const totalAnimationTime = (squaresToAdd * staggerDelay) + 1000;
    
    const fadeTimer = window.setTimeout(() => setFading(true), totalAnimationTime);
    const finishTimer = window.setTimeout(() => onComplete?.(), totalAnimationTime + 500);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(finishTimer);
    };
  }, [transition, onComplete]);

  if (!transition) return null;

  return (
    <div
      className={`ride-squares-overlay ${fading ? 'fade-out' : ''}`}
      role='status'
      aria-live='polite'
      onClick={() => onComplete?.()}
    >
      <div className="ride-squares-container" onClick={(e) => e.stopPropagation()}>
        <h2>Daily Target Progress</h2>
        <div className="ride-squares-grid">
          {Array.from({ length: 25 }, (_, i) => {
            const num = i + 1;
            const isAlreadyFilled = num <= transition.oldSquares;
            const isNew = num > transition.oldSquares && num <= transition.newSquares;
            const color = SQAURE_COLORS[Math.min(Math.floor((num - 1) / 5), SQAURE_COLORS.length - 1)];
            
            const staggerDelay = Math.max(150, Math.min(500, 2000 / ((transition.newSquares - transition.oldSquares) || 1)));
            const delaySec = isNew ? ((num - transition.oldSquares - 1) * (staggerDelay / 1000)) : 0;
            
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
