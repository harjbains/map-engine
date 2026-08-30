import { BIRMINGHAM_POSTCODE_GROUPS, postcodesForGroup, type PostcodeGroupId } from "../lib/birmingham-postcodes";

type PostcodeLookupProps = {
  openGroup: PostcodeGroupId | null;
  onChangeGroup: (group: PostcodeGroupId | null) => void;
};

export function PostcodeLookup({ openGroup, onChangeGroup }: PostcodeLookupProps) {
  const selectedGroup = openGroup
    ? BIRMINGHAM_POSTCODE_GROUPS.find((group) => group.id === openGroup) ?? null
    : null;
  const selectedPostcodes = openGroup ? postcodesForGroup(openGroup) : [];

  return (
    <>
      {selectedGroup && (
        <section className="postcode-lookup-panel" id="postcode-lookup-panel" role="region" aria-label={`Postcode map ${selectedGroup.rangeLabel}`}>
          <span className="postcode-lookup-kicker">POSTCODE MAP</span>
          <h2>{selectedGroup.rangeLabel}</h2>
          <p>{selectedPostcodes.length} postcode{selectedPostcodes.length === 1 ? "" : "s"} · green centres highlighted · the car marker shows your position</p>
          <button type="button" onClick={() => onChangeGroup(null)} aria-label="Close postcode map">×</button>
        </section>
      )}
      <nav className="postcode-dock" aria-label="Postcode quick lookup">
        {BIRMINGHAM_POSTCODE_GROUPS.map((group) => {
          const selected = openGroup === group.id;
          return (
            <button type="button" key={group.id} className={selected ? "selected" : ""} aria-label={`Map postcodes ${group.rangeLabel}`} aria-pressed={selected} aria-expanded={selected} aria-controls="postcode-lookup-panel" onClick={() => onChangeGroup(selected ? null : group.id)}>
              <span className="postcode-range-label">{group.prefix}{group.minimum}+</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}