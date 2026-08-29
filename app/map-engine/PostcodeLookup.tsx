import { BIRMINGHAM_POSTCODE_GROUPS, postcodesForGroup, relativePostcodeDirection, type PostcodeGroupId, type RelativePostcodeDirection } from "../lib/birmingham-postcodes";
import type { VehicleFix } from "./config";

const DIRECTION_LABELS: Record<RelativePostcodeDirection, { arrow: string; label: string }> = {
  ahead: { arrow: "↑", label: "AHEAD" },
  right: { arrow: "→", label: "RIGHT" },
  behind: { arrow: "↓", label: "BEHIND" },
  left: { arrow: "←", label: "LEFT" },
};

type PostcodeLookupProps = {
  fix: VehicleFix | null;
  openGroup: PostcodeGroupId | null;
  onChangeGroup: (group: PostcodeGroupId | null) => void;
};

export function PostcodeLookup({ fix, openGroup, onChangeGroup }: PostcodeLookupProps) {
  const selectedGroup = openGroup
    ? BIRMINGHAM_POSTCODE_GROUPS.find((group) => group.id === openGroup) ?? null
    : null;
  const selectedPostcodes = openGroup ? postcodesForGroup(openGroup) : [];

  return (
    <>
      {selectedGroup && (
        <section className="postcode-lookup-panel" id="postcode-lookup-panel" role="dialog" aria-modal="false" aria-label={`Postcode lookup ${selectedGroup.rangeLabel}`}>
          <header>
            <div><span>QUICK POSTCODE LOOKUP</span><h2>{selectedGroup.rangeLabel}</h2></div>
            <p>{fix ? "Approximate direction and distance to each postcode centre" : "Start live position to add ahead, left, right and behind guidance"}</p>
            <button type="button" onClick={() => onChangeGroup(null)} aria-label="Close postcode lookup">×</button>
          </header>
          <div className="postcode-lookup-grid">
            {selectedPostcodes.map((postcode) => {
              const relative = fix ? relativePostcodeDirection(fix, fix.bearing, postcode) : null;
              const direction = relative ? DIRECTION_LABELS[relative.direction] : null;
              const miles = relative ? (relative.miles < 10 ? relative.miles.toFixed(1) : Math.round(relative.miles).toString()) : null;
              return (
                <article key={postcode.code}>
                  <strong>{postcode.code}</strong>
                  <span title={postcode.areas}>{postcode.areas}</span>
                  {relative && direction && <small className={`postcode-direction ${relative.direction}`}><b>{direction.arrow} {direction.label}</b><em>{miles} mi</em></small>}
                </article>
              );
            })}
          </div>
        </section>
      )}
      <nav className="postcode-dock" aria-label="Postcode quick lookup">
        {BIRMINGHAM_POSTCODE_GROUPS.map((group) => {
          const selected = openGroup === group.id;
          return (
            <button type="button" key={group.id} className={selected ? "selected" : ""} aria-label={`Open postcodes ${group.rangeLabel}`} aria-pressed={selected} aria-expanded={selected} aria-controls="postcode-lookup-panel" onClick={() => onChangeGroup(selected ? null : group.id)}>
              <span className="postcode-range-label">{group.prefix}{group.minimum}+</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
