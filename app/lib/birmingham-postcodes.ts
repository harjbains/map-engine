import type { Point } from "./driving";

export type PostcodeGroupId = string;

export type BirminghamPostcode = {
  code: string;
  areas: string;
  latitude: number;
  longitude: number;
};

export type PostcodeGroup = {
  id: PostcodeGroupId;
  prefix: string;
  buttonLabel: string;
  rangeLabel: string;
  minimum: number;
  maximum: number;
};

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
  { code: "WV1", areas: "Wolverhampton City Centre", longitude: -2.128000, latitude: 52.587000 },
  { code: "WV2", areas: "Wolverhampton South · Parkfield", longitude: -2.127000, latitude: 52.566000 },
  { code: "WV3", areas: "Compton · Finchfield", longitude: -2.147000, latitude: 52.592000 },
  { code: "WV4", areas: "Spring Vale · Lanesfield", longitude: -2.090000, latitude: 52.564000 },
  { code: "WV5", areas: "Wombourne · Swindon", longitude: -2.177000, latitude: 52.531000 },
  { code: "WV6", areas: "Tettenhall · Whitmore Reans", longitude: -2.162000, latitude: 52.599000 },
  { code: "WV7", areas: "Albrighton · Donington · Ryton", longitude: -2.292000, latitude: 52.632000 },
  { code: "WV8", areas: "Codsall · Oaken", longitude: -2.200000, latitude: 52.631000 },
  { code: "WV9", areas: "Coven · Brewood", longitude: -2.220000, latitude: 52.666000 },
  { code: "WV10", areas: "Wednesfield · New Cross", longitude: -2.088000, latitude: 52.607000 },
  { code: "WV11", areas: "Wednesfield North", longitude: -2.055000, latitude: 52.606000 },
  { code: "WV12", areas: "Willenhall · Bentley", longitude: -2.040000, latitude: 52.589000 },
  { code: "WV13", areas: "Willenhall South · Darlaston", longitude: -2.058000, latitude: 52.575000 },
  { code: "WV14", areas: "Bilston · Bradley", longitude: -2.070000, latitude: 52.564000 },
  { code: "WV15", areas: "Bridgnorth · Alveley", longitude: -2.415000, latitude: 52.540000 },
  { code: "WV16", areas: "Bridgnorth town · Much Wenlock", longitude: -2.420000, latitude: 52.535000 },
  { code: "DY1", areas: "Dudley town centre", longitude: -2.083000, latitude: 52.510000 },
  { code: "DY2", areas: "Netherton · Woodside", longitude: -2.072000, latitude: 52.493000 },
  { code: "DY3", areas: "Sedgley · Himley", longitude: -2.115000, latitude: 52.545000 },
  { code: "DY4", areas: "Tipton · Great Bridge", longitude: -2.028000, latitude: 52.540000 },
  { code: "DY5", areas: "Brierley Hill · Netherton", longitude: -2.125000, latitude: 52.474000 },
  { code: "DY6", areas: "Kingswinford · Wall Heath", longitude: -2.160000, latitude: 52.510000 },
  { code: "DY7", areas: "Stourton · Kinver", longitude: -2.230000, latitude: 52.480000 },
  { code: "DY8", areas: "Stourbridge town", longitude: -2.165000, latitude: 52.458000 },
  { code: "DY9", areas: "Lye · Halesowen fringe", longitude: -2.115000, latitude: 52.440000 },
  { code: "DY10", areas: "Kidderminster town", longitude: -2.255000, latitude: 52.390000 },
  { code: "DY11", areas: "Kidderminster East", longitude: -2.225000, latitude: 52.385000 },
  { code: "DY12", areas: "Bewdley", longitude: -2.317000, latitude: 52.377000 },
  { code: "DY13", areas: "Stourport-on-Severn", longitude: -2.275000, latitude: 52.338000 },
  { code: "CV1", areas: "Coventry City Centre", longitude: -1.518000, latitude: 52.408000 },
  { code: "CV2", areas: "Coventry North East", longitude: -1.480000, latitude: 52.425000 },
  { code: "CV3", areas: "Wyken · Ernesford", longitude: -1.485000, latitude: 52.386000 },
  { code: "CV4", areas: "Canley · Tile Hill", longitude: -1.572000, latitude: 52.400000 },
  { code: "CV5", areas: "Earlsdon · Fiveways", longitude: -1.545000, latitude: 52.408000 },
  { code: "CV6", areas: "Holbrooks · Whitmore Park", longitude: -1.535000, latitude: 52.448000 },
  { code: "CV7", areas: "Meriden · Exhall", longitude: -1.656000, latitude: 52.438000 },
  { code: "CV8", areas: "Kenilworth · Stoneleigh", longitude: -1.580000, latitude: 52.348000 },
  { code: "CV11", areas: "Nuneaton town", longitude: -1.450000, latitude: 52.525000 },
  { code: "CV12", areas: "Bedworth · Bulkington", longitude: -1.475000, latitude: 52.480000 },
  { code: "CV21", areas: "Rugby town", longitude: -1.265000, latitude: 52.372000 },
  { code: "CV31", areas: "Leamington Spa", longitude: -1.540000, latitude: 52.284000 },
  { code: "CV34", areas: "Warwick · Woodloes Park", longitude: -1.590000, latitude: 52.282000 },
  { code: "CV35", areas: "Wellesbourne · Kineton", longitude: -1.625000, latitude: 52.205000 },
  { code: "CV36", areas: "Shipston-on-Stour", longitude: -1.628000, latitude: 52.062000 },
];

export const BIRMINGHAM_POSTCODE_GROUPS: PostcodeGroup[] = [
  { id: "b1", prefix: "B", buttonLabel: "B1–9", rangeLabel: "B1–B9", minimum: 1, maximum: 9 },
  { id: "b10", prefix: "B", buttonLabel: "B10–19", rangeLabel: "B10–B19", minimum: 10, maximum: 19 },
  { id: "b20", prefix: "B", buttonLabel: "B20–29", rangeLabel: "B20–B29", minimum: 20, maximum: 29 },
  { id: "b30", prefix: "B", buttonLabel: "B30–39", rangeLabel: "B30–B39", minimum: 30, maximum: 39 },
  { id: "b40", prefix: "B", buttonLabel: "B40–49", rangeLabel: "B40–B49", minimum: 40, maximum: 49 },
  { id: "b50", prefix: "B", buttonLabel: "B50–59", rangeLabel: "B50–B59", minimum: 50, maximum: 59 },
  { id: "b60", prefix: "B", buttonLabel: "B60–69", rangeLabel: "B60–B69", minimum: 60, maximum: 69 },
  { id: "b70", prefix: "B", buttonLabel: "B70–79", rangeLabel: "B70–B79", minimum: 70, maximum: 79 },
  { id: "b80", prefix: "B", buttonLabel: "B80–89", rangeLabel: "B80–B89", minimum: 80, maximum: 89 },
  { id: "b90", prefix: "B", buttonLabel: "B90–98", rangeLabel: "B90–B98", minimum: 90, maximum: 98 },
  ...["WV", "DY", "CV"].flatMap((prefix) => {
    const districts = [...new Set(BIRMINGHAM_POSTCODES.filter((postcode) => postcode.code.startsWith(prefix)).map((postcode) => districtNumber(postcode.code)))].sort((a, b) => a - b);
    return districts.map((number) => ({
      id: `${prefix.toLowerCase()}${number}`,
      prefix,
      buttonLabel: `${prefix}${number}`,
      rangeLabel: `${prefix}${number}`,
      minimum: number,
      maximum: number,
    }));
  }),
];

// Sub-district sectors for the West Midlands runs. Districts can be several miles
// across, so each button opens its sectors when available. These are approximations
// compiled for a split-second driving lookup, not Ordnance Survey boundaries.
export const POSTCODE_SECTORS: Partial<Record<PostcodeGroupId, BirminghamPostcode[]>> = {
  wv1: [
    { code: "WV1 1", areas: "City Centre · Queen Square", longitude: -2.1289, latitude: 52.5863 },
    { code: "WV1 2", areas: "City Centre · Mander Centre", longitude: -2.1310, latitude: 52.5867 },
    { code: "WV1 3", areas: "Railway Station · St George's", longitude: -2.1198, latitude: 52.5873 },
    { code: "WV1 4", areas: "All Saints · Horseley Fields", longitude: -2.1295, latitude: 52.5835 },
    { code: "WV1 9", areas: "City Centre west · Waterloo Road", longitude: -2.1350, latitude: 52.5862 },
  ],
  wv2: [
    { code: "WV2 1", areas: "Snow Hill · Cleveland", longitude: -2.1255, latitude: 52.5848 },
    { code: "WV2 2", areas: "Graiseley", longitude: -2.1248, latitude: 52.5789 },
    { code: "WV2 3", areas: "Blakenhall", longitude: -2.1225, latitude: 52.5713 },
    { code: "WV2 4", areas: "Parkfield", longitude: -2.1323, latitude: 52.5758 },
  ],
  wv3: [
    { code: "WV3 1", areas: "Compton east · St Andrew's", longitude: -2.1380, latitude: 52.5870 },
    { code: "WV3 2", areas: "West Park · Woodfield", longitude: -2.1455, latitude: 52.5838 },
    { code: "WV3 3", areas: "Finchfield north", longitude: -2.1620, latitude: 52.5852 },
    { code: "WV3 4", areas: "Finchfield south · Penn edge", longitude: -2.1660, latitude: 52.5805 },
    { code: "WV3 5", areas: "Newbridge", longitude: -2.1640, latitude: 52.5780 },
    { code: "WV3 6", areas: "Chapelfields · Paternoster", longitude: -2.1500, latitude: 52.5795 },
  ],
  wv4: [
    { code: "WV4 1", areas: "Springfield · Woodsetton", longitude: -2.1150, latitude: 52.5705 },
    { code: "WV4 2", areas: "Lanesfield", longitude: -2.1010, latitude: 52.5660 },
    { code: "WV4 3", areas: "Spring Vale", longitude: -2.0930, latitude: 52.5730 },
    { code: "WV4 4", areas: "Merry Hill", longitude: -2.1200, latitude: 52.5640 },
    { code: "WV4 5", areas: "Penn Fields", longitude: -2.1410, latitude: 52.5740 },
    { code: "WV4 6", areas: "Penn", longitude: -2.1500, latitude: 52.5680 },
  ],
  wv5: [
    { code: "WV5 1", areas: "Wombourne town", longitude: -2.1870, latitude: 52.5350 },
    { code: "WV5 2", areas: "Swindon · Orton", longitude: -2.1900, latitude: 52.5250 },
    { code: "WV5 3", areas: "Wombourne south · Ashwood", longitude: -2.2000, latitude: 52.5280 },
  ],
  wv6: [
    { code: "WV6 1", areas: "Whitmore Reans", longitude: -2.1390, latitude: 52.5910 },
    { code: "WV6 2", areas: "Dunstall Hill", longitude: -2.1320, latitude: 52.5940 },
    { code: "WV6 3", areas: "Tettenhall Wood", longitude: -2.1600, latitude: 52.5880 },
    { code: "WV6 4", areas: "Tettenhall town · Regis Road", longitude: -2.1670, latitude: 52.5920 },
    { code: "WV6 8", areas: "Wightwick · Perton edge", longitude: -2.1760, latitude: 52.5840 },
    { code: "WV6 9", areas: "Tettenhall village · Wood Road", longitude: -2.1710, latitude: 52.5900 },
  ],
  wv7: [
    { code: "WV7 1", areas: "Albrighton town", longitude: -2.2700, latitude: 52.6360 },
    { code: "WV7 2", areas: "Albrighton north · Boningale", longitude: -2.3000, latitude: 52.6420 },
    { code: "WV7 3", areas: "Donington", longitude: -2.2920, latitude: 52.6480 },
    { code: "WV7 4", areas: "Ryton · Woodcote", longitude: -2.3350, latitude: 52.6180 },
  ],
  wv8: [
    { code: "WV8 1", areas: "Codsall village", longitude: -2.1980, latitude: 52.6300 },
    { code: "WV8 2", areas: "Codsall Wood · Oaken", longitude: -2.2000, latitude: 52.6260 },
    { code: "WV8 3", areas: "Bilbrook", longitude: -2.1820, latitude: 52.6230 },
  ],
  wv9: [
    { code: "WV9 1", areas: "Coven", longitude: -2.2100, latitude: 52.6560 },
    { code: "WV9 2", areas: "Brewood · Bishops Wood", longitude: -2.2250, latitude: 52.6650 },
  ],
  wv10: [
    { code: "WV10 1", areas: "Bushbury", longitude: -2.1100, latitude: 52.6130 },
    { code: "WV10 2", areas: "Low Hill", longitude: -2.1050, latitude: 52.6060 },
    { code: "WV10 3", areas: "Wednesfield High", longitude: -2.0900, latitude: 52.6010 },
    { code: "WV10 4", areas: "Wednesfield village", longitude: -2.0850, latitude: 52.5990 },
    { code: "WV10 5", areas: "Fallings Park", longitude: -2.1050, latitude: 52.5950 },
    { code: "WV10 6", areas: "New Cross", longitude: -2.1150, latitude: 52.6100 },
  ],
  wv11: [
    { code: "WV11 1", areas: "Wednesfield north", longitude: -2.0800, latitude: 52.6060 },
    { code: "WV11 2", areas: "Wednesfield village", longitude: -2.0900, latitude: 52.6050 },
    { code: "WV11 3", areas: "Ashmore Park · Long Knowle", longitude: -2.0720, latitude: 52.6100 },
  ],
  wv12: [
    { code: "WV12 1", areas: "Willenhall south", longitude: -2.0600, latitude: 52.5840 },
    { code: "WV12 2", areas: "Willenhall · Short Heath", longitude: -2.0600, latitude: 52.5920 },
    { code: "WV12 3", areas: "Willenhall town · Stag's Head", longitude: -2.0400, latitude: 52.5900 },
    { code: "WV12 4", areas: "Willenhall north", longitude: -2.0450, latitude: 52.5960 },
  ],
  wv13: [
    { code: "WV13 2", areas: "Darlaston town", longitude: -2.0400, latitude: 52.5710 },
    { code: "WV13 3", areas: "Darlaston north · Moxley", longitude: -2.0450, latitude: 52.5770 },
    { code: "WV13 4", areas: "Willenhall south · County Bridge", longitude: -2.0480, latitude: 52.5800 },
  ],
  wv14: [
    { code: "WV14 6", areas: "Bilston town", longitude: -2.0720, latitude: 52.5660 },
    { code: "WV14 7", areas: "Bilston north · Priestfield", longitude: -2.0660, latitude: 52.5720 },
    { code: "WV14 8", areas: "Bradley · Coseley edge", longitude: -2.0820, latitude: 52.5580 },
    { code: "WV14 9", areas: "Ettingshall", longitude: -2.0880, latitude: 52.5560 },
  ],
  wv15: [
    { code: "WV15 5", areas: "Bridgnorth west · A458", longitude: -2.4200, latitude: 52.5350 },
    { code: "WV15 6", areas: "Bridgnorth east · Oldbury Wells", longitude: -2.3950, latitude: 52.5380 },
  ],
  wv16: [
    { code: "WV16 1", areas: "Bridgnorth High Town", longitude: -2.4190, latitude: 52.5360 },
    { code: "WV16 4", areas: "Bridgnorth Low Town", longitude: -2.4140, latitude: 52.5310 },
  ],
};

function districtNumber(code: string) {
  return Number(code.replace(/^[A-Z]+/, ""));
}

export function postcodesForGroup(groupId: PostcodeGroupId) {
  const sectors = POSTCODE_SECTORS[groupId];
  if (sectors && sectors.length) return sectors;
  const group = BIRMINGHAM_POSTCODE_GROUPS.find((candidate) => candidate.id === groupId);
  if (!group) return [];
  return BIRMINGHAM_POSTCODES.filter((postcode) => {
    const district = districtNumber(postcode.code);
    return postcode.code.startsWith(group.prefix) && district >= group.minimum && district <= group.maximum;
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
