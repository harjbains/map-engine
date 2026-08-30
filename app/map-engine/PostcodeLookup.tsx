import { BIRMINGHAM_POSTCODE_GROUPS, type PostcodeGroupId } from "../lib/birmingham-postcodes";
import type { VehicleFix } from "./config";
import { PostcodeMapWindow } from "./PostcodeMapWindow";

type PostcodeLookupProps = {
  fix: VehicleFix | null;
  openGroup: PostcodeGroupId | null;
  onChangeGroup: (group: PostcodeGroupId | null) => void;
};

export function PostcodeLookup({ fix, openGroup, onChangeGroup }: PostcodeLookupProps) {
  const selectedGroup = openGroup
    ? BIRMINGHAM_POSTCODE_GROUPS.find((group) => group.id === openGroup) ?? null
    : null;

  return (
    <>
      {selectedGroup && (
        <PostcodeMapWindow group={selectedGroup} fix={fix} onClose={() => onChangeGroup(null)} />
      )}
      <nav className="postcode-dock" aria-label="Postcode quick lookup">
        {BIRMINGHAM_POSTCODE_GROUPS.map((group) => {
          const selected = openGroup === group.id;
          return (
            <button type="button" key={group.id} className={selected ? "selected" : ""} aria-label={`Map postcodes ${group.rangeLabel}`} aria-pressed={selected} aria-expanded={selected} aria-controls="postcode-map-window" onClick={() => onChangeGroup(selected ? null : group.id)}>
              <span className="postcode-range-label">{group.prefix}{group.minimum}+</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}