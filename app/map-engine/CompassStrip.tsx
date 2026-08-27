type CompassStripProps = { bearing: number };

const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function CompassStrip({ bearing }: CompassStripProps) {
  const heading = ((bearing % 360) + 360) % 360;
  const compassStep = heading / 45;
  const compassIndex = Math.round(compassStep);
  const compassFraction = compassStep - compassIndex;
  const compassPoints = Array.from({ length: 7 }, (_, position) => {
    const offset = position - 3;
    const directionIndex = (compassIndex - offset + 80) % 8;
    return { direction: DIRECTIONS[directionIndex], offset };
  });

  return (
    <section className="compass-strip" aria-label={`Map heading ${Math.round(heading)} degrees`}>
      <div className="compass-window">
        <div className="compass-scale" style={{ transform: `translateX(calc(-50% + ${compassFraction * 60}px))` }}>
          {compassPoints.map(({ direction, offset }) => <span className={offset === 0 ? "is-centre" : ""} key={`${direction}-${offset}`}>{direction}</span>)}
        </div>
      </div>
      <i aria-hidden="true" />
    </section>
  );
}
