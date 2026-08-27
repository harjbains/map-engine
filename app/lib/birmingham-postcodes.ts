import type { Point } from "./driving";

export type PostcodeGroupId = "b1" | "b10" | "b20" | "b30" | "b40" | "b50" | "b60" | "b70" | "b80" | "b90";

export type BirminghamPostcode = {
  code: string;
  areas: string;
  latitude: number;
  longitude: number;
};

export const BIRMINGHAM_POSTCODE_GROUPS: Array<{
  id: PostcodeGroupId;
  buttonLabel: string;
  rangeLabel: string;
  minimum: number;
  maximum: number;
}> = [
  { id: "b1", buttonLabel: "B1–9", rangeLabel: "B1–B9", minimum: 1, maximum: 9 },
  { id: "b10", buttonLabel: "B10–19", rangeLabel: "B10–B19", minimum: 10, maximum: 19 },
  { id: "b20", buttonLabel: "B20–29", rangeLabel: "B20–B29", minimum: 20, maximum: 29 },
  { id: "b30", buttonLabel: "B30–39", rangeLabel: "B30–B39", minimum: 30, maximum: 39 },
  { id: "b40", buttonLabel: "B40–49", rangeLabel: "B40–B49", minimum: 40, maximum: 49 },
  { id: "b50", buttonLabel: "B50–59", rangeLabel: "B50–B59", minimum: 50, maximum: 59 },
  { id: "b60", buttonLabel: "B60–69", rangeLabel: "B60–B69", minimum: 60, maximum: 69 },
  { id: "b70", buttonLabel: "B70–79", rangeLabel: "B70–B79", minimum: 70, maximum: 79 },
  { id: "b80", buttonLabel: "B80–89", rangeLabel: "B80–B89", minimum: 80, maximum: 89 },
  { id: "b90", buttonLabel: "B90–98", rangeLabel: "B90–B98", minimum: 90, maximum: 98 },
];

// Familiar coverage names are deliberately concise for a split-second driving lookup.
// Coordinates are outward-code centroids, so directions are useful approximations only.
export const BIRMINGHAM_POSTCODES: BirminghamPostcode[] = [
  { code: "B1", areas: "City Centre · Jewellery Quarter", longitude: -1.909485, latitude: 52.479706 },
  { code: "B2", areas: "City Centre · New Street", longitude: -1.897173, latitude: 52.487811 },
  { code: "B3", areas: "City Centre · Newhall Street", longitude: -1.903621, latitude: 52.483950 },
  { code: "B4", areas: "City Centre · Aston University", longitude: -1.892727, latitude: 52.485272 },
  { code: "B5", areas: "Digbeth · Highgate · Edgbaston", longitude: -1.897656, latitude: 52.468878 },
  { code: "B6", areas: "Aston · Birchfield · Witton", longitude: -1.886124, latitude: 52.505232 },
  { code: "B7", areas: "Nechells · Vauxhall · Duddeston", longitude: -1.872394, latitude: 52.494107 },
  { code: "B8", areas: "Alum Rock · Washwood Heath", longitude: -1.841348, latitude: 52.491137 },
  { code: "B9", areas: "Bordesley Green · Small Heath", longitude: -1.850874, latitude: 52.478229 },
  { code: "B10", areas: "Small Heath · Hay Mills", longitude: -1.852302, latitude: 52.469573 },
  { code: "B11", areas: "Sparkhill · Tyseley · Greet", longitude: -1.858618, latitude: 52.454441 },
  { code: "B12", areas: "Balsall Heath · Sparkbrook", longitude: -1.884416, latitude: 52.461037 },
  { code: "B13", areas: "Moseley · Billesley · Moor Green", longitude: -1.878671, latitude: 52.437710 },
  { code: "B14", areas: "Kings Heath · Yardley Wood", longitude: -1.889827, latitude: 52.417334 },
  { code: "B15", areas: "Edgbaston · Westside", longitude: -1.923276, latitude: 52.466291 },
  { code: "B16", areas: "Ladywood · Edgbaston", longitude: -1.934197, latitude: 52.477514 },
  { code: "B17", areas: "Harborne · Edgbaston", longitude: -1.958726, latitude: 52.461254 },
  { code: "B18", areas: "Winson Green · Hockley · Soho", longitude: -1.925464, latitude: 52.491178 },
  { code: "B19", areas: "Lozells · Newtown · Hockley", longitude: -1.905666, latitude: 52.497108 },
  { code: "B20", areas: "Handsworth Wood · Birchfield", longitude: -1.919214, latitude: 52.515550 },
  { code: "B21", areas: "Handsworth", longitude: -1.941471, latitude: 52.506905 },
  { code: "B23", areas: "Erdington · Stockland Green", longitude: -1.855253, latitude: 52.528512 },
  { code: "B24", areas: "Erdington · Tyburn · Bromford", longitude: -1.827012, latitude: 52.519726 },
  { code: "B25", areas: "Yardley · Hay Mills", longitude: -1.821746, latitude: 52.465188 },
  { code: "B26", areas: "Sheldon · Airport · Elmdon", longitude: -1.788660, latitude: 52.461514 },
  { code: "B27", areas: "Acocks Green", longitude: -1.822736, latitude: 52.444522 },
  { code: "B28", areas: "Hall Green · Yardley Wood", longitude: -1.843134, latitude: 52.427550 },
  { code: "B29", areas: "Selly Oak · Bournbrook", longitude: -1.947505, latitude: 52.437675 },
  { code: "B30", areas: "Bournville · Stirchley · Cotteridge", longitude: -1.927731, latitude: 52.422010 },
  { code: "B31", areas: "Northfield · Longbridge · West Heath", longitude: -1.973850, latitude: 52.407987 },
  { code: "B32", areas: "Bartley Green · Quinton · Woodgate", longitude: -1.994506, latitude: 52.448386 },
  { code: "B33", areas: "Kitts Green · Stechford · Lea Hall", longitude: -1.788415, latitude: 52.480345 },
  { code: "B34", areas: "Shard End · Buckland End", longitude: -1.781700, latitude: 52.496426 },
  { code: "B35", areas: "Castle Vale", longitude: -1.788834, latitude: 52.518933 },
  { code: "B36", areas: "Castle Bromwich · Hodge Hill", longitude: -1.778495, latitude: 52.504167 },
  { code: "B37", areas: "Chelmsley Wood · Marston Green", longitude: -1.742292, latitude: 52.478531 },
  { code: "B38", areas: "Kings Norton · Hawkesley", longitude: -1.934774, latitude: 52.399875 },
  { code: "B40", areas: "NEC · Airport · Resorts World", longitude: -1.720578, latitude: 52.456208 },
  { code: "B42", areas: "Perry Barr · Great Barr · Hamstead", longitude: -1.911735, latitude: 52.533838 },
  { code: "B43", areas: "Great Barr · Pheasey", longitude: -1.930850, latitude: 52.548499 },
  { code: "B44", areas: "Kingstanding · Perry Barr", longitude: -1.885089, latitude: 52.545701 },
  { code: "B45", areas: "Rubery · Rednal · Longbridge", longitude: -2.008857, latitude: 52.388668 },
  { code: "B46", areas: "Coleshill · Water Orton", longitude: -1.694769, latitude: 52.509044 },
  { code: "B47", areas: "Hollywood · Wythall", longitude: -1.879867, latitude: 52.385477 },
  { code: "B48", areas: "Alvechurch · Barnt Green", longitude: -1.946925, latitude: 52.354702 },
  { code: "B49", areas: "Alcester · Great Alne", longitude: -1.867251, latitude: 52.218081 },
  { code: "B50", areas: "Bidford-on-Avon · Broom", longitude: -1.856056, latitude: 52.167967 },
  { code: "B60", areas: "Bromsgrove · Stoke Prior", longitude: -2.051589, latitude: 52.325194 },
  { code: "B61", areas: "Bromsgrove · Catshill · Fairfield", longitude: -2.068780, latitude: 52.346564 },
  { code: "B62", areas: "Halesowen · Romsley · Quinton", longitude: -2.033767, latitude: 52.456540 },
  { code: "B63", areas: "Halesowen · Hasbury · Cradley", longitude: -2.069974, latitude: 52.451470 },
  { code: "B64", areas: "Cradley Heath · Old Hill", longitude: -2.069368, latitude: 52.472571 },
  { code: "B65", areas: "Rowley Regis · Blackheath", longitude: -2.043825, latitude: 52.483631 },
  { code: "B66", areas: "Smethwick · Bearwood · Warley", longitude: -1.964657, latitude: 52.492692 },
  { code: "B67", areas: "Smethwick · Bearwood", longitude: -1.978803, latitude: 52.485606 },
  { code: "B68", areas: "Oldbury · Langley · Quinton", longitude: -2.001376, latitude: 52.478652 },
  { code: "B69", areas: "Oldbury · Tividale", longitude: -2.030222, latitude: 52.502770 },
  { code: "B70", areas: "West Bromwich · Swan Village", longitude: -2.004482, latitude: 52.521024 },
  { code: "B71", areas: "West Bromwich · Stone Cross", longitude: -1.990494, latitude: 52.536064 },
  { code: "B72", areas: "Sutton Coldfield town centre", longitude: -1.821925, latitude: 52.550090 },
  { code: "B73", areas: "Boldmere · Wylde Green", longitude: -1.842302, latitude: 52.553262 },
  { code: "B74", areas: "Four Oaks · Streetly · Mere Green", longitude: -1.862257, latitude: 52.584349 },
  { code: "B75", areas: "Mere Green · Roughley · Falcon Lodge", longitude: -1.808266, latitude: 52.578604 },
  { code: "B76", areas: "Walmley · Minworth · Curdworth", longitude: -1.781731, latitude: 52.543416 },
  { code: "B77", areas: "Tamworth · Wilnecote · Amington", longitude: -1.668062, latitude: 52.618709 },
  { code: "B78", areas: "Tamworth · Fazeley · Kingsbury", longitude: -1.674427, latitude: 52.606359 },
  { code: "B79", areas: "Tamworth · Hopwas · Warton", longitude: -1.680221, latitude: 52.650489 },
  { code: "B80", areas: "Studley · Mappleborough Green", longitude: -1.892256, latitude: 52.273296 },
  { code: "B90", areas: "Shirley · Dickens Heath", longitude: -1.825645, latitude: 52.398293 },
  { code: "B91", areas: "Solihull · Blossomfield", longitude: -1.783534, latitude: 52.414007 },
  { code: "B92", areas: "Olton · Elmdon · Hampton-in-Arden", longitude: -1.773209, latitude: 52.437226 },
  { code: "B93", areas: "Dorridge · Knowle · Bentley Heath", longitude: -1.744263, latitude: 52.380249 },
  { code: "B94", areas: "Hockley Heath · Earlswood", longitude: -1.794673, latitude: 52.349595 },
  { code: "B95", areas: "Henley-in-Arden · Wootton Wawen", longitude: -1.780687, latitude: 52.285801 },
  { code: "B96", areas: "Feckenham · Astwood Bank", longitude: -1.960396, latitude: 52.251474 },
  { code: "B97", areas: "Redditch · Webheath · Callow Hill", longitude: -1.954782, latitude: 52.299633 },
  { code: "B98", areas: "Redditch · Beoley", longitude: -1.912931, latitude: 52.302161 },
];

function districtNumber(code: string) {
  return Number(code.slice(1));
}

export function postcodesForGroup(groupId: PostcodeGroupId) {
  const group = BIRMINGHAM_POSTCODE_GROUPS.find((candidate) => candidate.id === groupId);
  if (!group) return [];
  return BIRMINGHAM_POSTCODES.filter((postcode) => {
    const district = districtNumber(postcode.code);
    return district >= group.minimum && district <= group.maximum;
  });
}

function bearingTo(origin: Point, destination: Point) {
  const originLatitude = origin.latitude * Math.PI / 180;
  const destinationLatitude = destination.latitude * Math.PI / 180;
  const longitudeDelta = (destination.longitude - origin.longitude) * Math.PI / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(destinationLatitude);
  const x = Math.cos(originLatitude) * Math.sin(destinationLatitude)
    - Math.sin(originLatitude) * Math.cos(destinationLatitude) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function distanceMiles(origin: Point, destination: Point) {
  const earthRadiusMiles = 3_958.8;
  const latitudeDelta = (destination.latitude - origin.latitude) * Math.PI / 180;
  const longitudeDelta = (destination.longitude - origin.longitude) * Math.PI / 180;
  const originLatitude = origin.latitude * Math.PI / 180;
  const destinationLatitude = destination.latitude * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export type RelativePostcodeDirection = "ahead" | "right" | "behind" | "left";

export function relativePostcodeDirection(origin: Point, heading: number, postcode: BirminghamPostcode) {
  const destination = { latitude: postcode.latitude, longitude: postcode.longitude };
  const difference = ((bearingTo(origin, destination) - heading + 540) % 360) - 180;
  const absoluteDifference = Math.abs(difference);
  const direction: RelativePostcodeDirection = absoluteDifference <= 45
    ? "ahead"
    : absoluteDifference >= 135
      ? "behind"
      : difference > 0 ? "right" : "left";
  return { direction, miles: distanceMiles(origin, destination) };
}
