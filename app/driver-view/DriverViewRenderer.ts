import type { ApproachInfo, SceneControls } from "./DriverViewAdapter";
import type { BuildingKind } from "./DriverViewRoad";

const Z_NEAR = 1.5;
const Z_FAR = 120;
const CAM_H = 1.5;
const ROAD_HALF = 3.6;

export const ROAD_FIRST = {
  worldObjects: false,
  realBuildings: false,
};

const VERGE = ["#4c6b3d", "#5d7f4a", "#43593a", "#6a8a55"];
const TREE = ["#35573a", "#45693f", "#2f4d36"];
const VERGE_ROOF = "#334a2a";
const TREE_ROOF = "#2a3c2d";

export const BUILDING_COLOURS: Record<BuildingKind, readonly [string, string]> = {
  house: ["#c9886e", "#7e4a3a"],
  apartments: ["#c2a574", "#8a6a3f"],
  shop: ["#e3c664", "#a07c2c"],
  office: ["#9fb1bd", "#5d7a92"],
  industrial: ["#9d9489", "#6a5f52"],
  civic: ["#d6cfbf", "#97a0a0"],
  other: ["#a8abae", "#787b80"],
};

const DEFAULT_HEIGHTS: Record<BuildingKind, number> = {
  house: 6.2,
  apartments: 12.5,
  shop: 6.0,
  office: 16,
  industrial: 9.5,
  civic: 12,
  other: 7.5,
};

const DEFAULT_BUILDINGS: ReadonlyArray<{ kind: BuildingKind; base: string; roof: string }> = [
  { kind: "house", base: "#c9886e", roof: "#7e4a3a" },
  { kind: "apartments", base: "#c2a574", roof: "#8a6a3f" },
  { kind: "shop", base: "#e3c664", roof: "#a07c2c" },
  { kind: "office", base: "#9fb1bd", roof: "#5d7a92" },
  { kind: "industrial", base: "#9d9489", roof: "#6a5f52" },
];

export type WorldObject = {
  kind: "verge" | "post" | "tree" | "building" | "streak";
  side: 1 | -1;
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  base: string;
  roof: string;
  seed: number;
};

export type SceneFootprint = {
  height: number;
  kind: BuildingKind;
  base: string;
  roof: string;
  seed: number;
  ring: Array<{ x: number; z: number }>;
};

export type RouteEvent = {
  x: number;
  z: number;
  metres: number;
  kind: "junction" | "roundabout";
  turn: number;
  side: 1 | -1;
  label: string;
  arrow: string;
};

export type RoadBranch = {
  z: number;
  side: 1 | -1;
  kind: "corner" | "side";
  name: string | null;
  cross: boolean;
};

export type SceneState = {
  width: number;
  height: number;
  cx: number;
  horizon: number;
  focal: number;
  tiltCur: number;
  bend: number;
  headingCur: number | null;
  rnd: () => number;
  world: WorldObject[];
  buildings: SceneFootprint[];
  roundabouts: SceneRoundabout[];
  branches: RoadBranch[];
  centerline: Array<{ x: number; z: number }>;
  events: RouteEvent[];
  signals: Array<{ x: number; z: number }>;
  syntheticLights: boolean;
};

export type SceneRoundabout = {
  ring: Array<{ x: number; z: number }>;
  centre: { x: number; z: number };
  radiusMetres: number;
  exits: Array<{ join: { x: number; z: number }; outward: { x: number; z: number }; name: string | null }>;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rnd: () => number, values: readonly string[]) {
  return values[Math.floor(rnd() * values.length)];
}

function shade(hex: string, amount = 0.8): string {
  if (!hex.startsWith("#")) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * amount);
  const g = Math.round(((n >> 8) & 255) * amount);
  const b = Math.round((n & 255) * amount);
  return `rgb(${r},${g},${b})`;
}

function spawn(rnd: () => number, side: 1 | -1, z: number): WorldObject {
  const roll = rnd();
  const seed = Math.floor(rnd() * 4294967296);
  if (roll < 0.09) {
    return { kind: "streak", side, x: side * (6.5 + rnd() * 5), z, w: 0.9, h: 3.6, d: 0, base: "rgba(255,255,255,0.32)", roof: "", seed };
  }
  if (roll < 0.32) {
    return { kind: "post", side, x: side * (7 + rnd() * 6), z, w: 0.28, h: 3.1 + rnd() * 1.4, d: 0.28, base: "rgba(255,255,255,0.75)", roof: "rgba(255,255,255,0.5)", seed };
  }
  if (roll < 0.6) {
    return { kind: "verge", side, x: side * (8 + rnd() * 7), z, w: 1.6 + rnd() * 2.6, h: 0.5 + rnd() * 0.55, d: 1.6 + rnd() * 2.6, base: pick(rnd, VERGE), roof: VERGE_ROOF, seed };
  }
  if (roll < 0.8) {
    return { kind: "tree", side, x: side * (9 + rnd() * 9), z, w: 1.1 + rnd() * 1.3, h: 2.6 + rnd() * 2.4, d: 1.1 + rnd() * 1.3, base: pick(rnd, TREE), roof: TREE_ROOF, seed };
  }
  const item = DEFAULT_BUILDINGS[Math.floor(rnd() * DEFAULT_BUILDINGS.length)];
  const near = z < 70;
  const heightScale = near ? 0.85 + rnd() * 0.5 : 0.7 + rnd() * 0.5;
  return {
    kind: "building",
    side,
    x: side * (13 + rnd() * 16),
    z,
    w: 5 + rnd() * 7,
    h: (DEFAULT_HEIGHTS[item.kind] || 6) * heightScale,
    d: 4 + rnd() * 5,
    base: item.base,
    roof: item.roof,
    seed: Math.floor(rnd() * 4294967296),
  };
}

function respawn(rnd: () => number, object: WorldObject) {
  const side = (rnd() < 0.5 ? 1 : -1) as 1 | -1;
  Object.assign(object, spawn(rnd, side, Z_FAR + rnd() * 40));
}

export function buildScene(width: number, height: number): SceneState {
  const rnd = mulberry32((Math.random() * 4294967296) >>> 0);
  const world: WorldObject[] = [];
  let side: 1 | -1 = 1;
  for (let i = 0; i < 18; i += 1) {
    side = (side * -1) as 1 | -1;
    world.push(spawn(rnd, side, 2.5 + i * 7 + rnd() * 6));
  }
  return {
    width,
    height,
    cx: width / 2,
    horizon: Math.round(height * 0.45),
    focal: height * 0.9,
    tiltCur: 0,
    bend: 0,
    headingCur: null,
    rnd,
    world,
    buildings: [],
    roundabouts: [],
    branches: [],
    centerline: [],
    events: [],
    signals: [],
    syntheticLights: true,
  };
}

export function localiseRoute(coordinates: Array<[number, number]>, position: { lat: number; lon: number }, headingDegrees: number, maxZ = 950): Array<{ x: number; z: number }> {
  const cosLat = Math.cos((position.lat * Math.PI) / 180);
  const sinH = Math.sin((headingDegrees * Math.PI) / 180);
  const cosH = Math.cos((headingDegrees * Math.PI) / 180);
  const points: Array<{ x: number; z: number }> = [];
  for (const [lon, lat] of coordinates) {
    const east = (lon - position.lon) * 111320 * cosLat;
    const north = (lat - position.lat) * 111320;
    const x = east * cosH - north * sinH;
    const z = east * sinH + north * cosH;
    if (z < -4) continue;
    if (z > maxZ) break;
    if (points.length) {
      const last = points[points.length - 1];
      if (Math.abs(x - last.x) < 0.8 && Math.abs(z - last.z) < 0.8) continue;
    }
    points.push({ x, z });
  }
  return points;
}

function localPoint(position: { lat: number; lon: number }, headingDegrees: number, lon: number, lat: number) {
  const cosLat = Math.cos((position.lat * Math.PI) / 180);
  const sinH = Math.sin((headingDegrees * Math.PI) / 180);
  const cosH = Math.cos((headingDegrees * Math.PI) / 180);
  const east = (lon - position.lon) * 111320 * cosLat;
  const north = (lat - position.lat) * 111320;
  return { x: east * cosH - north * sinH, z: east * sinH + north * cosH };
}

export function zAtMetres(points: Array<{ x: number; z: number }>, metres: number): number {
  if (points.length === 0) return 0;
  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const segment = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    if (travelled + segment >= metres) {
      const fraction = segment > 0.0001 ? (metres - travelled) / segment : 0;
      return points[i - 1].z + (points[i].z - points[i - 1].z) * fraction;
    }
    travelled += segment;
  }
  return points[points.length - 1].z;
}

export type EdgeGap = [number, number];

export function edgeBreaks(branches: RoadBranch[], side: 1 | -1): EdgeGap[] {
  return branches
    .filter((branch) => branch.side === side && branch.kind === "side")
    .map((branch) => [branch.z - 2.6, branch.z + 2.6] as EdgeGap)
    .sort((a, b) => a[0] - b[0]);
}

function clX(scene: SceneState, z: number): number {
  const centerline = scene.centerline;
  if (centerline.length === 0) return 0;
  if (z <= centerline[0].z) return centerline[0].x;
  if (z >= centerline[centerline.length - 1].z) return centerline[centerline.length - 1].x;
  for (let i = 1; i < centerline.length; i += 1) {
    if (z <= centerline[i].z) {
      const span = centerline[i].z - centerline[i - 1].z;
      const t = span > 0 ? (z - centerline[i - 1].z) / span : 0;
      return centerline[i - 1].x + (centerline[i].x - centerline[i - 1].x) * t;
    }
  }
  return centerline[centerline.length - 1].x;
}

function project(scene: SceneState, x: number, z: number) {
  const zz = Math.max(Z_NEAR, z);
  const falloff = Math.min(1, Math.max(0, (zz - Z_NEAR) / (Z_FAR - Z_NEAR)));
  return { x: scene.cx + (scene.focal * x) / zz + scene.bend * falloff, y: scene.horizon + (scene.focal * CAM_H) / zz };
}

function drawSky(ctx: CanvasRenderingContext2D, scene: SceneState) {
  const gradient = ctx.createLinearGradient(0, 0, 0, scene.horizon + 4);
  gradient.addColorStop(0, "#87b3dd");
  gradient.addColorStop(0.55, "#b8d4ea");
  gradient.addColorStop(1, "#dcebf5");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, scene.width, scene.horizon + 4);
  const sunX = scene.width * 0.72 - scene.bend * 0.3;
  const sunY = scene.horizon * 0.32;
  const sunR = Math.max(14, scene.height * 0.065);
  ctx.fillStyle = "rgba(252,238,181,0.35)";
  ctx.beginPath();
  ctx.arc(sunX - scene.bend * 0.1, sunY, sunR * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f7e49a";
  ctx.beginPath();
  ctx.arc(sunX - scene.bend * 0.1, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(scene.width * 0.3 - scene.bend * 0.35, scene.horizon * 0.28, scene.width * 0.09, scene.height * 0.026, 0, 0, Math.PI * 2);
  ctx.ellipse(scene.width * 0.44 - scene.bend * 0.35, scene.horizon * 0.55, scene.width * 0.12, scene.height * 0.028, 0, 0, Math.PI * 2);
  ctx.ellipse(scene.width * 0.86 - scene.bend * 0.35, scene.horizon * 0.45, scene.width * 0.08, scene.height * 0.022, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHills(ctx: CanvasRenderingContext2D, scene: SceneState) {
  ctx.fillStyle = "#4b6a77";
  ctx.beginPath();
  ctx.moveTo(0, scene.horizon + 8);
  for (let x = 0; x <= scene.width + 8; x += 8) {
    const n = Math.sin(x * 0.013) * 12 + Math.sin(x * 0.037 + 2) * 8;
    ctx.lineTo(x - scene.bend * 0.55, scene.horizon + 2 - n);
  }
  ctx.lineTo(scene.width, scene.horizon + 4);
  ctx.lineTo(0, scene.horizon + 4);
  ctx.closePath();
  ctx.fill();
}

function drawGround(ctx: CanvasRenderingContext2D, scene: SceneState) {
  const gradient = ctx.createLinearGradient(0, scene.horizon, 0, scene.height);
  gradient.addColorStop(0, "#272f35");
  gradient.addColorStop(1, "#12171b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, scene.horizon + 4, scene.width, scene.height - scene.horizon - 4);
}

function roadPoints(scene: SceneState, offset: number) {
  const zs = [1.8, 2.8, 4.2, 6, 9, 13, 19, 28, 42, 62, 90, 120];
  return zs.map((z) => project(scene, clX(scene, z) + offset, z));
}

function drawRouteRibbon(ctx: CanvasRenderingContext2D, scene: SceneState) {
  if (scene.centerline.length < 2) return;
  const zs = [1.8, 2.8, 4.2, 6, 9, 13, 19, 28, 42, 62, 90, 120];
  const left: Array<{ x: number; y: number }> = [];
  const right: Array<{ x: number; y: number }> = [];
  for (const z of zs) {
    const centre = clX(scene, z);
    left.push(project(scene, centre - 1.1, z));
    right.push(project(scene, centre + 1.1, z));
  }
  ctx.fillStyle = "rgba(66,140,232,0.15)";
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const point of left) ctx.lineTo(point.x, point.y);
  for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(96,170,240,0.32)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const point of left) ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(right[0].x, right[0].y);
  for (const point of right) ctx.lineTo(point.x, point.y);
  ctx.stroke();
}

function strokeRun(ctx: CanvasRenderingContext2D, run: Array<{ x: number; y: number }>) {
  if (run.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(run[0].x, run[0].y);
  for (const point of run.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
}

function inAnyGap(z: number, gaps: EdgeGap[]): boolean {
  for (const [a, b] of gaps) {
    if (z >= a && z <= b) return true;
  }
  return false;
}

function drawEdgeWithBreaks(ctx: CanvasRenderingContext2D, scene: SceneState, offset: number, side: 1 | -1) {
  const gaps = edgeBreaks(scene.branches, side);
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 3;
  if (gaps.length === 0) {
    const pts = roadPoints(scene, offset);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const point of pts) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    return;
  }
  let run: Array<{ x: number; y: number }> = [];
  for (let z = 1.8; z <= 120; z += 1.5) {
    if (!inAnyGap(z, gaps)) {
      run.push(project(scene, clX(scene, z) + offset, z));
    } else {
      strokeRun(ctx, run);
      run = [];
    }
  }
  strokeRun(ctx, run);
}

function drawRoundabouts(ctx: CanvasRenderingContext2D, scene: SceneState) {
  for (const rb of scene.roundabouts) {
    if (rb.centre.z < -12 || rb.centre.z > 320) continue;
    const ringPts = rb.ring.map((point) => project(scene, point.x, point.z));
    if (ringPts.length < 3) continue;
    if (ringPts.some((point) => point.y > scene.height + 60)) continue;
    ctx.fillStyle = "#20272c";
    ctx.beginPath();
    ctx.moveTo(ringPts[0].x, ringPts[0].y);
    for (const point of ringPts.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const island = rb.ring.map((point) => {
      const ix = rb.centre.x + (point.x - rb.centre.x) * 0.52;
      const iz = rb.centre.z + (point.z - rb.centre.z) * 0.52;
      return project(scene, ix, iz);
    });
    ctx.fillStyle = "#2e3a2c";
    ctx.beginPath();
    ctx.moveTo(island[0].x, island[0].y);
    for (const point of island.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const exit of rb.exits) {
      if (exit.join.z < Z_NEAR + 0.4 || exit.join.z > 240) continue;
      const dirX = exit.outward.x - exit.join.x;
      const dirZ = exit.outward.z - exit.join.z;
      const dirLen = Math.hypot(dirX, dirZ);
      if (dirLen < 1) continue;
      const ux = dirX / dirLen;
      const uz = dirZ / dirLen;
      const px = -uz;
      const pz = ux;
      const sideP = ROAD_HALF + 0.4;
      const legLen = Math.min(7, Math.max(3, rb.radiusMetres * 0.45));
      const reach = Math.min(1, legLen / dirLen);
      const a = project(scene, exit.join.x + px * sideP, exit.join.z + pz * sideP);
      const b = project(scene, exit.join.x - px * sideP, exit.join.z - pz * sideP);
      const c = project(scene, exit.join.x + ux * dirLen * reach - px * sideP, exit.join.z + uz * dirLen * reach - pz * sideP);
      const d = project(scene, exit.join.x + ux * dirLen * reach + px * sideP, exit.join.z + uz * dirLen * reach + pz * sideP);
      ctx.fillStyle = "#20272c";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      const gwA = project(scene, exit.join.x + ux * 1.6 + px * (sideP - 0.5), exit.join.z + uz * 1.6 + pz * (sideP - 0.5));
      const gwB = project(scene, exit.join.x + ux * 1.6 - px * (sideP - 0.5), exit.join.z + uz * 1.6 - pz * (sideP - 0.5));
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 2.4]);
      ctx.beginPath();
      ctx.moveTo(gwA.x, gwA.y);
      ctx.lineTo(gwB.x, gwB.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (exit.name) drawSignboard(ctx, scene, exit.outward.x, exit.outward.z, exit.name, exit.name);
    }
  }
}

function drawJunctionMouths(ctx: CanvasRenderingContext2D, scene: SceneState) {
  const mouthHalf = 2.6;
  const sideLen = 9;
  const farSpan = 1.3;
  for (const branch of scene.branches) {
    if (branch.kind !== "side") continue;
    if (branch.z < Z_NEAR + 0.6 || branch.z > 120) continue;
    const jx = clX(scene, branch.z);
    const side = branch.side;
    const n1 = project(scene, jx + side * ROAD_HALF, branch.z - mouthHalf);
    const n2 = project(scene, jx + side * ROAD_HALF, branch.z + mouthHalf);
    const f1 = project(scene, jx + side * (ROAD_HALF + sideLen), branch.z - farSpan);
    const f2 = project(scene, jx + side * (ROAD_HALF + sideLen), branch.z + farSpan);
    ctx.fillStyle = "#272e34";
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(f1.x, f1.y);
    ctx.lineTo(f2.x, f2.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(f1.x, f1.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(n2.x, n2.y);
    ctx.lineTo(f2.x, f2.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(f1.x, f1.y);
    ctx.lineTo(f2.x, f2.y);
    ctx.stroke();
    const d1 = project(scene, jx + side * (ROAD_HALF + 1.1), branch.z - mouthHalf + 0.5);
    const d2 = project(scene, jx + side * (ROAD_HALF + 1.1), branch.z + mouthHalf - 0.5);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.3;
    ctx.setLineDash([3, 2.6]);
    ctx.beginPath();
    ctx.moveTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const cornerR = 1.4 * (scene.focal / Math.max(Z_NEAR, branch.z));
    ctx.fillStyle = "#272e34";
    ctx.beginPath();
    ctx.arc(n1.x, n1.y, Math.max(1.5, cornerR), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(n2.x, n2.y, Math.max(1.5, cornerR), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(n1.x, n1.y, Math.max(1.5, cornerR), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(n2.x, n2.y, Math.max(1.5, cornerR), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPavements(ctx: CanvasRenderingContext2D, scene: SceneState) {
  for (const side of [-1, 1] as const) {
    const inner = roadPoints(scene, side * (ROAD_HALF + 0.1));
    const outer = roadPoints(scene, side * (ROAD_HALF + 2.4));
    ctx.fillStyle = "#2b3237";
    ctx.beginPath();
    ctx.moveTo(inner[0].x, inner[0].y);
    for (const point of inner) ctx.lineTo(point.x, point.y);
    for (let i = outer.length - 1; i >= 0; i -= 1) ctx.lineTo(outer[i].x, outer[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(214,219,222,0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(inner[0].x, inner[0].y);
    for (const point of inner) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, scene: SceneState) {
  const left = roadPoints(scene, -ROAD_HALF);
  const right = roadPoints(scene, ROAD_HALF);
  ctx.fillStyle = "#20272c";
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const point of left) ctx.lineTo(point.x, point.y);
  for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();

  drawPavements(ctx, scene);

  drawJunctionMouths(ctx, scene);

  drawEdgeWithBreaks(ctx, scene, -(ROAD_HALF - 0.42), -1);
  drawEdgeWithBreaks(ctx, scene, ROAD_HALF - 0.42, 1);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  const dashes: Array<[number, number]> = [];
  for (let z = 2; z < 120; z += 9) {
    if (Math.floor((z - 2) / 9) % 2 === 0) dashes.push([z, Math.min(z + 4, 120)]);
  }
  const mouthZs = scene.branches
    .filter((branch) => branch.kind === "side")
    .map((branch) => branch.z);
  for (const [a, b] of dashes) {
    if (mouthZs.some((z) => z >= a - 2.6 && z <= b + 2.6)) continue;
    const start = project(scene, clX(scene, a), a);
    const end = project(scene, clX(scene, b), b);
    const width = Math.max(1.4, (end.y - start.y) * 0.11);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = width;
    ctx.stroke();
  }
  drawRouteRibbon(ctx, scene);
}

function drawBlock(ctx: CanvasRenderingContext2D, scene: SceneState, object: WorldObject) {
  const p = project(scene, clX(scene, object.z) + object.x, object.z);
  const scale = scene.focal / Math.max(Z_NEAR, object.z);
  const w = object.w * scale;
  const h = object.h * scale;
  const d = object.d * scale * 0.62;
  const ex = Math.sign(object.side) * d;
  const left = p.x - w / 2;
  const right = p.x + w / 2;
  const top = p.y - h;
  const lift = d * 0.42;

  ctx.fillStyle = object.base;
  ctx.fillRect(left, top, w, h);

  ctx.fillStyle = object.roof;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left + ex, top - lift);
  ctx.lineTo(right + ex, top - lift);
  ctx.lineTo(right, top);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = shade(object.base);
  ctx.beginPath();
  ctx.moveTo(right, top);
  ctx.lineTo(right + ex, top - lift);
  ctx.lineTo(right + ex, p.y - lift);
  ctx.lineTo(right, p.y);
  ctx.closePath();
  ctx.fill();
}

function drawObject(ctx: CanvasRenderingContext2D, scene: SceneState, object: WorldObject) {
  if (object.z < Z_NEAR) return;
  if (object.kind === "building" && object.z < 14) return;
  const p = project(scene, clX(scene, object.z) + object.x, object.z);
  const scale = scene.focal / Math.max(Z_NEAR, object.z);
  if (scale > scene.height * 1.2) return;
  const w = object.w * scale;
  const h = object.h * scale;

  if (object.kind === "streak") {
    ctx.strokeStyle = object.base;
    ctx.lineWidth = Math.max(1, 0.5 * scale);
    ctx.beginPath();
    ctx.moveTo(p.x - w / 2, p.y - h);
    ctx.lineTo(p.x - w / 2, p.y + h * 0.55);
    ctx.stroke();
    return;
  }
  if (object.kind === "post") {
    ctx.fillStyle = object.base;
    ctx.fillRect(p.x - w / 2, p.y - h, w, h);
    ctx.fillStyle = object.roof;
    ctx.beginPath();
    ctx.moveTo(p.x - w, p.y - h);
    ctx.lineTo(p.x + w, p.y - h);
    ctx.lineTo(p.x, p.y - h - w * 1.1);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (object.kind === "tree") {
    drawBlock(ctx, scene, object);
    return;
  }
  drawBlock(ctx, scene, object);
  if (object.kind === "building" && scale >= 5.5) {
    ctx.fillStyle = "rgba(255,221,140,0.5)";
    const margin = w * 0.16;
    const cols = 3;
    const rows = 4;
    const cellW = (w - margin * 2) / cols;
    const cellH = (h * 0.75) / rows;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if ((object.seed >> (r * 2 + c)) & 1) continue;
        ctx.fillRect(p.x - w / 2 + margin + c * cellW, p.y - h + h * 0.1 + r * cellH, cellW * 0.6, cellH * 0.55);
      }
    }
  }
}

function drawBuildingWalls(ctx: CanvasRenderingContext2D, scene: SceneState) {
  if (scene.buildings.length === 0) return;
  const quads: Array<{
    corners: Array<{ x: number; y: number }>;
    depth: number;
    facing: number;
    kind: BuildingKind;
    seed: number;
    base: string;
    height: number;
  }> = [];
  for (const building of scene.buildings) {
    const ring = building.ring;
    if (ring.length < 3) continue;
    let centroidX = 0;
    let centroidZ = 0;
    for (const point of ring) {
      centroidX += point.x;
      centroidZ += point.z;
    }
    centroidX /= ring.length;
    centroidZ /= ring.length;
    for (let i = 0; i < ring.length; i += 1) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      if (p.z < -2 && q.z < -2) continue;
      if (Math.min(p.z, q.z) > 220) continue;
      const groundP = project(scene, p.x, p.z);
      const groundQ = project(scene, q.x, q.z);
      const topP = project(scene, p.x, p.z);
      topP.y = scene.horizon + (scene.focal * (CAM_H - building.height)) / Math.max(Z_NEAR, p.z);
      const topQ = project(scene, q.x, q.z);
      topQ.y = scene.horizon + (scene.focal * (CAM_H - building.height)) / Math.max(Z_NEAR, q.z);
      const edgeX = q.x - p.x;
      const edgeZ = q.z - p.z;
      const midX = (p.x + q.x) / 2;
      const midZ = (p.z + q.z) / 2;
      let normalX = -edgeZ;
      let normalZ = edgeX;
      const toCentroidX = centroidX - midX;
      const toCentroidZ = centroidZ - midZ;
      if (normalX * toCentroidX + normalZ * toCentroidZ < 0) {
        normalX = -normalX;
        normalZ = -normalZ;
      }
      const normalLen = Math.hypot(normalX, normalZ) || 1;
      normalX /= normalLen;
      normalZ /= normalLen;
      const facing = -(normalX * midX + normalZ * midZ) / (Math.hypot(midX, midZ) || 1);
      if (facing <= 0) continue;
      quads.push({
        corners: [groundP, groundQ, topQ, topP],
        depth: (p.z + q.z) / 2,
        facing,
        kind: building.kind,
        seed: building.seed,
        base: building.base,
        height: building.height,
      });
    }
  }
  quads.sort((a, b) => b.depth - a.depth);
  for (const quad of quads) {
    const brightness = 0.7 + 0.3 * quad.facing;
    ctx.fillStyle = shade(quad.base, brightness);
    ctx.beginPath();
    ctx.moveTo(quad.corners[0].x, quad.corners[0].y);
    for (const corner of quad.corners.slice(1)) ctx.lineTo(corner.x, corner.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
    drawBuildingWindows(ctx, quad);
  }
}

function drawBuildingWindows(ctx: CanvasRenderingContext2D, quad: { corners: Array<{ x: number; y: number }>; facing: number; kind: BuildingKind; seed: number; base: string; depth: number; height: number }) {
  if (quad.facing < 0.72 || quad.depth < 2 || quad.depth > 55) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const corner of quad.corners) {
    if (corner.x < minX) minX = corner.x;
    if (corner.x > maxX) maxX = corner.x;
    if (corner.y < minY) minY = corner.y;
    if (corner.y > maxY) maxY = corner.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 14 || height < 10) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(quad.corners[0].x, quad.corners[0].y);
  for (const corner of quad.corners.slice(1)) ctx.lineTo(corner.x, corner.y);
  ctx.closePath();
  ctx.clip();

  const plinth = Math.min(height * 0.16, 12);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(minX, maxY - plinth, width, plinth);

  if (quad.kind === "shop") {
    const glassH = Math.min(height * 0.42, Math.max(12, height * 0.32));
    ctx.fillStyle = "rgba(160,210,235,0.4)";
    ctx.fillRect(minX, maxY - glassH, width, glassH);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(minX, maxY - glassH, width, 1.5);
    const fasciaH = Math.min(height * 0.12, 9);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(minX, maxY - glassH - fasciaH, width, fasciaH);
    ctx.fillStyle = "rgba(30,28,26,0.92)";
    ctx.fillRect(minX + width * 0.06, maxY - glassH + 2, width * 0.13, glassH - 4);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    const mullions = Math.max(2, Math.min(6, Math.floor(width / 24)));
    const mullionW = width / mullions;
    for (let c = 1; c < mullions; c += 1) {
      ctx.fillRect(minX + c * mullionW - 0.75, maxY - glassH + 2, 1.5, glassH - 4);
    }
    ctx.restore();
    return;
  }

  if (quad.kind === "industrial") {
    const bands = Math.max(1, Math.min(4, Math.floor(height / 40)));
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    for (let b = 1; b <= bands; b += 1) {
      ctx.fillRect(minX, minY + (height * b) / (bands + 1) - 1, width, 2);
    }
    ctx.restore();
    return;
  }

  const rows = Math.max(2, Math.min(6, Math.round(quad.height / 3)));
  const cols = Math.max(2, Math.min(6, Math.round(width / 18)));
  const cellW = width / cols;
  const cellH = height / rows;
  if (quad.kind === "office") {
    const bandH = cellH * 0.34;
    for (let r = 0; r < rows; r += 1) {
      ctx.fillStyle = "rgba(185,210,228,0.3)";
      ctx.fillRect(minX, minY + r * cellH + (cellH - bandH) / 2, width, bandH);
    }
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    for (let c = 1; c < cols * 2; c += 1) {
      ctx.fillRect(minX + (width / (cols * 2)) * c - 0.6, minY, 1.2, height);
    }
    ctx.restore();
    return;
  }
  const rowsActual = quad.kind === "civic" ? Math.max(rows, 3) : rows;
  const winW = cellW * 0.52;
  const winH = cellH * (quad.kind === "civic" ? 0.5 : 0.42);
  for (let r = 0; r < rowsActual; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = (quad.seed >> (r * 5 + c)) & 1;
      ctx.fillStyle = lit ? "rgba(255,226,150,0.55)" : "rgba(28,26,24,0.55)";
      const px = minX + c * cellW + (cellW - winW) / 2;
      const py = minY + r * cellH + (cellH - winH) / 2;
      ctx.fillRect(px, py, winW, winH);
    }
  }
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, scene: SceneState) {
  const gradient = ctx.createLinearGradient(0, 0, 0, scene.height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.62, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, scene.width, scene.height);
}

export function buildEvents(points: Array<{ x: number; z: number }>, steps: Array<{ arrow: string; road: string; metres: number }>): RouteEvent[] {
  const events: RouteEvent[] = [];
  if (points.length < 2) return events;
  let stepIndex = 0;
  let runSum = 0;
  const emit = (index: number, metresAt: number, roundabout: boolean, turn: number) => {
    const step = steps[Math.min(stepIndex, Math.max(0, steps.length - 1))];
    if (steps.length) stepIndex += 1;
    events.push({
      x: points[index].x,
      z: points[index].z,
      metres: metresAt,
      kind: roundabout ? "roundabout" : "junction",
      turn,
      side: runSum > 0 ? 1 : -1,
      label: step?.road || (roundabout ? "Roundabout" : "Next road"),
      arrow: step?.arrow || (roundabout ? "↻" : "↑"),
    });
  };
  let metres = 0;
  let heading: number | null = null;
  let runIndex = -1;
  let runActive = false;
  let runDistance = 0;
  const finishRun = () => {
    if (runActive && Math.abs(runSum) >= 8) {
      if (Math.abs(runSum) >= 150 && runDistance <= 200) emit(runIndex, metres, true, runSum);
      else emit(runIndex, metres, false, runSum);
    }
    runActive = false;
    runSum = 0;
    runIndex = -1;
    runDistance = 0;
  };
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dz = points[i].z - points[i - 1].z;
    const segment = Math.hypot(dx, dz);
    metres += segment;
    if (segment < 0.05) continue;
    const currentHeading = Math.atan2(dx, dz);
    if (heading === null) {
      heading = currentHeading;
      continue;
    }
    let delta = currentHeading - heading;
    heading = currentHeading;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const degrees = (delta * 180) / Math.PI;
    if (Math.abs(degrees) >= 8) {
      if (runActive && Math.sign(runSum) !== Math.sign(degrees)) finishRun();
      if (!runActive) {
        runIndex = i;
        runActive = true;
        runSum = degrees;
        runDistance = segment;
      } else {
        runSum += degrees;
        runDistance += segment;
      }
    } else {
      finishRun();
    }
  }
  finishRun();
  return events;
}

function drawSignboard(ctx: CanvasRenderingContext2D, scene: SceneState, x: number, z: number, label: string, sublabel: string) {
  const p = project(scene, x, z);
  const scale = Math.min(1.7, scene.focal / Math.max(Z_NEAR, z));
  const size = Math.max(10, 15 * scale);
  const width = Math.max(46, Math.min(240, label.length * size * 0.62 + size * 2.2));
  const height = Math.max(16, size * 1.35);
  ctx.fillStyle = "#5a5f66";
  ctx.fillRect(p.x - 1.5 * scale, p.y - height - size * 2.4, 3 * scale, size * 2.4);
  ctx.fillStyle = "#0b6e3f";
  ctx.strokeStyle = "#e8f0e6";
  ctx.lineWidth = 1.2;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(p.x - width / 2, p.y - height - size * 1.4, width, height, 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(p.x - width / 2, p.y - height - size * 1.4, width, height);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label || sublabel, p.x, p.y - height - size * 1.4 + height / 2);
  if (sublabel && sublabel !== label) {
    ctx.fillStyle = "#d7e8cf";
    ctx.font = `600 ${size * 0.62}px system-ui, sans-serif`;
    ctx.fillText(sublabel, p.x, p.y - height - size * 1.4 + height + size * 0.42);
  }
}

function drawTrafficLight(ctx: CanvasRenderingContext2D, scene: SceneState, x: number, z: number, seed: number) {
  const p = project(scene, x, z);
  const scale = Math.min(1.6, scene.focal / Math.max(Z_NEAR, z));
  const poleWidth = Math.max(1.6, 0.5 * scale);
  const headWidth = Math.max(7, 2.6 * scale);
  const lampRadius = Math.max(1.6, headWidth * 0.24);
  const phase = (Date.now() / 1000 + seed) % 6;
  const lights = phase < 3.2 ? ["#3f4a50", "#3f4a50", "#45e06a"] : phase < 4.1 ? ["#3f4a50", "#ffd23e", "#3f4a50"] : ["#ff4a3d", "#3f4a50", "#3f4a50"];
  const headTop = p.y - headWidth * 2.4 - poleWidth * 3;
  ctx.fillStyle = "#25292d";
  ctx.fillRect(p.x - poleWidth / 2, headTop, poleWidth, headWidth * 2.4 + poleWidth * 3);
  ctx.fillStyle = "#11181d";
  ctx.fillRect(p.x - headWidth / 2, headTop, headWidth, headWidth * 1.9);
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = lights[i];
    ctx.beginPath();
    ctx.arc(p.x, headTop + headWidth * 0.5 + i * headWidth * 0.6, lampRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRealSignals(ctx: CanvasRenderingContext2D, scene: SceneState) {
  for (const signal of scene.signals) {
    if (signal.z < Z_NEAR + 0.3 || signal.z > 250) continue;
    drawTrafficLight(ctx, scene, signal.x, signal.z, Math.round(signal.z / 7));
  }
}

function drawBranchLabels(ctx: CanvasRenderingContext2D, scene: SceneState) {
  for (const branch of scene.branches) {
    if (branch.kind !== "side" || !branch.name) continue;
    if (branch.z < Z_NEAR || branch.z > 200) continue;
    const jx = clX(scene, branch.z);
    const duplicateCorner = scene.branches.some(
      (other) => other.kind === "corner" && other.side === branch.side && Math.abs(other.z - branch.z) < 6,
    );
    if (duplicateCorner) continue;
    drawSignboard(ctx, scene, jx + branch.side * (ROAD_HALF + 2.1), branch.z, branch.name, branch.name);
  }
}

function drawJunctionOverlay(ctx: CanvasRenderingContext2D, scene: SceneState, event: RouteEvent) {
  if (event.z < Z_NEAR || event.z > 200) return;
  if (event.kind === "roundabout") {
    const p = project(scene, event.x, event.z);
    const real = scene.roundabouts.some(
      (rb) => Math.abs(rb.centre.z - event.z) < 16 && Math.abs(rb.centre.x - event.x) < 16,
    );
    if (!real) {
      const scale = scene.focal / Math.max(Z_NEAR, event.z);
      const outer = 11.5 * scale;
      const inner = 6.4 * scale;
      ctx.fillStyle = "#20272c";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, outer, outer * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#151b1f";
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, inner, inner * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    drawSignboard(ctx, scene, event.x - 6.5, event.z, event.label, "ROUNDABOUT");
    if (scene.syntheticLights) drawTrafficLight(ctx, scene, event.x - ROAD_HALF - 1.6, event.z, Math.round(event.metres / 7));
    return;
  }
  const bandX = 9;
  const bandDepth = 2.6;
  const pts = [
    project(scene, event.x - bandX, event.z - bandDepth),
    project(scene, event.x + bandX, event.z - bandDepth),
    project(scene, event.x + bandX, event.z + bandDepth),
    project(scene, event.x - bandX, event.z + bandDepth),
  ];
  ctx.fillStyle = "#242c32";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[3].x, pts[3].y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.stroke();
  const signSide = event.turn > 0 ? ROAD_HALF + 1.6 : -(ROAD_HALF + 1.6);
  drawSignboard(ctx, scene, event.x + signSide, event.z, event.label, event.turn > 0 ? "TURN RIGHT" : event.turn < 0 ? "TURN LEFT" : "AHEAD");
  if (scene.syntheticLights) drawTrafficLight(ctx, scene, event.x - signSide * 0.4, event.z, Math.round(event.metres / 7));
}

function drawJunctions(ctx: CanvasRenderingContext2D, scene: SceneState): ApproachInfo | null {
  let approach: ApproachInfo | null = null;
  for (const event of scene.events) {
    if (event.z < Z_NEAR + 0.4 || event.z > 350) continue;
    drawJunctionOverlay(ctx, scene, event);
    if (!approach) {
      approach = { kind: event.kind, label: event.label, metres: event.metres, arrow: event.arrow };
    }
  }
  return approach;
}

export function renderScene(ctx: CanvasRenderingContext2D, scene: SceneState, controls: SceneControls, dt: number): ApproachInfo | null {
  const speedMps = Math.max(0, controls.speedMph) * 0.44704;
  const step = speedMps * dt;
  scene.tiltCur += (controls.tilt - scene.tiltCur) * Math.min(1, dt * 5);
  scene.bend = scene.tiltCur * 4.5;
  const position = controls.position;
  if (position) {
    const targetHeading = position.bearing;
    if (scene.headingCur === null) {
      scene.headingCur = targetHeading;
    } else {
      const delta = ((targetHeading - scene.headingCur + 540) % 360) - 180;
      scene.headingCur = (scene.headingCur + delta * Math.min(1, dt * 3.4) + 360) % 360;
    }
  }
  const heading = scene.headingCur ?? position?.bearing ?? 0;
  let routePoints: Array<{ x: number; z: number }> = [];
  let stepsToUse: Array<{ arrow: string; road: string; metres: number }> = controls.routeSteps ?? [];
  let signals: Array<{ x: number; z: number }> = [];
  let syntheticLights = true;
  if (position && controls.route.length >= 2) {
    routePoints = localiseRoute(controls.route, position, heading);
  } else if (position && controls.roadContext) {
    routePoints = localiseRoute(controls.roadContext.trace, position, heading);
    stepsToUse = controls.roadContext.steps ?? [];
    signals = (controls.roadContext.signals ?? []).map(([lon, lat]) => localPoint(position, heading, lon, lat));
    syntheticLights = false;
  }
  scene.centerline = routePoints;
  scene.events = buildEvents(routePoints, stepsToUse);
  scene.signals = signals;
  scene.syntheticLights = syntheticLights;
  scene.buildings = [];
  scene.roundabouts = [];
  scene.branches = [];
  if (position && controls.roadContext) {
    for (const rb of controls.roadContext.roundabouts) {
      const ring = rb.ring.map(([lon, lat]) => localPoint(position, heading, lon, lat));
      const centre = localPoint(position, heading, rb.centre[0], rb.centre[1]);
      const exits = rb.exits.map((exit) => ({
        join: localPoint(position, heading, exit.join[0], exit.join[1]),
        outward: localPoint(position, heading, exit.outward[0], exit.outward[1]),
        name: exit.name,
      }));
      scene.roundabouts.push({ ring, centre, radiusMetres: rb.radiusMetres, exits });
    }
  }
  for (const event of scene.events) {
    if (event.kind === "roundabout") continue;
    scene.branches.push({ z: event.z, side: event.side, kind: "corner", name: event.label, cross: false });
  }
  const junctions = position ? (controls.roadContext?.junctions ?? null) : null;
  if (junctions) {
    const hasBothSides = new Set<number>();
    for (const junction of junctions) {
      if (junctions.some((other) => other !== junction && Math.abs(other.metres - junction.metres) < 8 && other.side !== junction.side)) {
        hasBothSides.add(Math.round(junction.metres));
      }
    }
    for (const junction of junctions) {
      scene.branches.push({
        z: zAtMetres(routePoints, junction.metres),
        side: junction.side,
        kind: "side",
        name: junction.name,
        cross: hasBothSides.has(Math.round(junction.metres)),
      });
    }
  }
  if (!ROAD_FIRST.realBuildings) {
    const realFootprints = position ? (controls.roadContext?.buildings ?? []) : [];
    for (const footprint of realFootprints) {
      const ring: Array<{ x: number; z: number }> = [];
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const [lon, lat] of footprint.ring) {
        const local = localPoint(position!, heading, lon, lat);
        ring.push(local);
        if (local.x < minX) minX = local.x;
        if (local.x > maxX) maxX = local.x;
        if (local.z < minZ) minZ = local.z;
        if (local.z > maxZ) maxZ = local.z;
      }
      if (ring.length < 3 || maxZ < -6 || minZ > 300) continue;
      const cx = (minX + maxX) / 2;
      const cz = Math.max(1.8, (minZ + maxZ) / 2);
      const [base, roof] = BUILDING_COLOURS[footprint.kind] ?? BUILDING_COLOURS.other;
      const seed = (Math.abs(cx * 97) + Math.abs(cz * 131) + Math.abs((footprint.height || 1) * 17)) >>> 0;
      const height = footprint.height || DEFAULT_HEIGHTS[footprint.kind] || DEFAULT_HEIGHTS.other;
      scene.buildings.push({
        height,
        kind: footprint.kind,
        base,
        roof,
        seed,
        ring,
      });
    }
  }
  for (const object of scene.world) {
    object.z -= step;
    if (object.z < Z_NEAR) respawn(scene.rnd, object);
  }
  drawSky(ctx, scene);
  drawHills(ctx, scene);
  drawGround(ctx, scene);
  drawRoundabouts(ctx, scene);
  drawRoad(ctx, scene);
  const approach = drawJunctions(ctx, scene);
  if (!scene.syntheticLights) drawRealSignals(ctx, scene);
  drawBranchLabels(ctx, scene);
  const hasRealBuildings = scene.buildings.length > 0;
  const inMouth = (side: 1 | -1, x: number, z: number) =>
    scene.branches.some(
      (branch) =>
        branch.kind === "side" &&
        branch.side === side &&
        z >= branch.z - 2.7 &&
        z <= branch.z + 2.7 &&
        Math.abs(x - side * (ROAD_HALF + 4.5)) < 6,
    );
  if (ROAD_FIRST.worldObjects) {
    for (const object of scene.world
      .filter((item) => !(hasRealBuildings && item.kind === "building"))
      .filter((item) => !(item.kind !== "building" && inMouth(item.side, item.x, item.z)))
      .sort((a, b) => b.z - a.z)) drawObject(ctx, scene, object);
  }
  drawBuildingWalls(ctx, scene);
  drawBranchLabels(ctx, scene);
  drawVignette(ctx, scene);
  return approach;
}

function nearestApproach(event: RouteEvent): ApproachInfo {
  return {
    kind: event.kind,
    label: event.label,
    metres: Math.max(0, event.metres),
    arrow: event.arrow,
  };
}

export function computeApproach(coordinates: Array<[number, number]>, position: { lat: number; lon: number }, headingDegrees: number, steps: Array<{ arrow: string; road: string; metres: number }>): ApproachInfo | null {
  const points = localiseRoute(coordinates, position, headingDegrees, 950);
  const events = buildEvents(points, steps);
  if (events.length === 0) return null;
  let nearest: RouteEvent | null = null;
  for (const event of events) {
    if (event.metres < 12) continue;
    if (nearest === null || event.metres < nearest.metres) nearest = event;
  }
  return nearest ? nearestApproach(nearest) : null;
}