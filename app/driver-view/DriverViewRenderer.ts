import type { ApproachInfo, SceneControls } from "./DriverViewAdapter";

const Z_NEAR = 1.6;
const Z_FAR = 90;
const CAM_H = 1.15;
const ROAD_HALF = 3.6;

const VERGE = ["#4c6b3d", "#5d7f4a", "#43593a", "#6a8a55"];
const TREE = ["#35573a", "#45693f", "#2f4d36"];
const BUILDINGS: ReadonlyArray<readonly [string, string]> = [
  ["#7a5d4a", "#4d352a"],
  ["#93a1ae", "#547082"],
  ["#b3a88f", "#6d6249"],
  ["#c98f7a", "#7e4a3a"],
];
const VERGE_ROOF = "#334a2a";
const TREE_ROOF = "#2a3c2d";

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

export type RouteEvent = {
  x: number;
  z: number;
  metres: number;
  kind: "junction" | "roundabout";
  turn: number;
  label: string;
  arrow: string;
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
  centerline: Array<{ x: number; z: number }>;
  events: RouteEvent[];
  signals: Array<{ x: number; z: number }>;
  syntheticLights: boolean;
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

function shade(hex: string, amount = 0.82): string {
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
  const [base, roof] = BUILDINGS[Math.floor(rnd() * BUILDINGS.length)];
  return { kind: "building", side, x: side * (13 + rnd() * 16), z, w: 5 + rnd() * 7, h: 4.5 + rnd() * 7, d: 4 + rnd() * 5, base, roof, seed };
}

function respawn(rnd: () => number, object: WorldObject) {
  const side = (rnd() < 0.5 ? 1 : -1) as 1 | -1;
  Object.assign(object, spawn(rnd, side, Z_FAR + rnd() * 40));
}

export function buildScene(width: number, height: number): SceneState {
  const rnd = mulberry32((Math.random() * 4294967296) >>> 0);
  const world: WorldObject[] = [];
  let side: 1 | -1 = 1;
  for (let i = 0; i < 15; i += 1) {
    side = (side * -1) as 1 | -1;
    world.push(spawn(rnd, side, 2.5 + i * 7 + rnd() * 6));
  }
  return {
    width,
    height,
    cx: width / 2,
    horizon: Math.round(height * 0.4),
    focal: height * 0.95,
    tiltCur: 0,
    bend: 0,
    headingCur: null,
    rnd,
    world,
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
  const falloff = Math.max(0, 1 - (z - Z_NEAR) / (Z_FAR - Z_NEAR));
  return { x: scene.cx + (scene.focal * x) / zz + scene.bend * falloff, y: scene.horizon + (scene.focal * CAM_H) / zz };
}

function drawSky(ctx: CanvasRenderingContext2D, scene: SceneState) {
  const gradient = ctx.createLinearGradient(0, 0, 0, scene.horizon + 4);
  gradient.addColorStop(0, "#87b3dd");
  gradient.addColorStop(0.55, "#b8d4ea");
  gradient.addColorStop(1, "#dcebf5");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, scene.width, scene.horizon + 4);
  const sunX = scene.width * 0.72;
  const sunY = scene.horizon * 0.38;
  const sunR = Math.max(14, scene.height * 0.075);
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
  ctx.ellipse(scene.width * 0.3 - scene.bend * 0.12, scene.horizon * 0.3, scene.width * 0.09, scene.height * 0.028, 0, 0, Math.PI * 2);
  ctx.ellipse(scene.width * 0.44 - scene.bend * 0.12, scene.horizon * 0.62, scene.width * 0.12, scene.height * 0.03, 0, 0, Math.PI * 2);
  ctx.ellipse(scene.width * 0.86 - scene.bend * 0.12, scene.horizon * 0.5, scene.width * 0.08, scene.height * 0.024, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHills(ctx: CanvasRenderingContext2D, scene: SceneState) {
  ctx.fillStyle = "#4b6a77";
  ctx.beginPath();
  ctx.moveTo(0, scene.horizon + 8);
  for (let x = 0; x <= scene.width + 8; x += 8) {
    const n = Math.sin(x * 0.013) * 14 + Math.sin(x * 0.037 + 2) * 10;
    ctx.lineTo(x - scene.bend * 0.25, scene.horizon + 2 - n);
  }
  ctx.lineTo(scene.width, scene.horizon + 4);
  ctx.lineTo(0, scene.horizon + 4);
  ctx.closePath();
  ctx.fill();
}

function drawGround(ctx: CanvasRenderingContext2D, scene: SceneState) {
  const gradient = ctx.createLinearGradient(0, scene.horizon, 0, scene.height);
  gradient.addColorStop(0, "#1a2126");
  gradient.addColorStop(1, "#0b0e11");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, scene.horizon + 4, scene.width, scene.height - scene.horizon - 4);
}

function roadPoints(scene: SceneState, offset: number) {
  const zs = [1.8, 4, 8, 16, 32, 60, 90];
  return zs.map((z) => project(scene, clX(scene, z) + offset, z));
}

function drawRouteRibbon(ctx: CanvasRenderingContext2D, scene: SceneState) {
  if (scene.centerline.length < 2) return;
  const left: Array<{ x: number; y: number }> = [];
  const right: Array<{ x: number; y: number }> = [];
  for (const z of [2, 4, 8, 16, 26, 40, 60, 90]) {
    const centre = clX(scene, z);
    left.push(project(scene, centre - 1.35, z));
    right.push(project(scene, centre + 1.25, z));
  }
  ctx.fillStyle = "rgba(92,170,244,0.85)";
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const point of left) ctx.lineTo(point.x, point.y);
  for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(38,116,208,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const point of left) ctx.lineTo(point.x, point.y);
  ctx.stroke();
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

  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 3;
  for (const edge of [roadPoints(scene, -(ROAD_HALF - 0.42)), roadPoints(scene, ROAD_HALF - 0.42)]) {
    ctx.beginPath();
    ctx.moveTo(edge[0].x, edge[0].y);
    for (const point of edge) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  const dashes: Array<[number, number]> = [];
  for (let z = 2; z < 90; z += 9) {
    if (Math.floor((z - 2) / 9) % 2 === 0) dashes.push([z, Math.min(z + 4, 90)]);
  }
  for (const [a, b] of dashes) {
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
  if (object.kind === "building" && scale >= 6.5) {
    ctx.fillStyle = "rgba(255,221,140,0.5)";
    const margin = w * 0.16;
    const cols = 2;
    const rows = 3;
    const cellW = (w - margin * 2) / cols;
    const cellH = (h * 0.72) / rows;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if ((object.seed >> (r * 2 + c)) & 1) continue;
        ctx.fillRect(p.x - w / 2 + margin + c * cellW, p.y - h + h * 0.12 + r * cellH, cellW * 0.6, cellH * 0.55);
      }
    }
  }
}

function drawVignette(ctx: CanvasRenderingContext2D, scene: SceneState) {
  const gradient = ctx.createLinearGradient(0, 0, 0, scene.height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.62, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, scene.width, scene.height);
}

function buildEvents(points: Array<{ x: number; z: number }>, steps: Array<{ arrow: string; road: string; metres: number }>): RouteEvent[] {
  const events: RouteEvent[] = [];
  if (points.length < 2) return events;
  let stepIndex = 0;
  const emit = (index: number, metresAt: number, roundabout: boolean, turn: number) => {
    const step = steps[Math.min(stepIndex, Math.max(0, steps.length - 1))];
    if (steps.length) stepIndex += 1;
    events.push({
      x: points[index].x,
      z: points[index].z,
      metres: metresAt,
      kind: roundabout ? "roundabout" : "junction",
      turn,
      label: step?.road || (roundabout ? "Roundabout" : "Next road"),
      arrow: step?.arrow || (roundabout ? "↻" : "↑"),
    });
  };
  let metres = 0;
  let heading: number | null = null;
  let runSum = 0;
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
    let currentHeading = Math.atan2(dx, dz);
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

function drawJunctionOverlay(ctx: CanvasRenderingContext2D, scene: SceneState, event: RouteEvent) {
  if (event.z < Z_NEAR || event.z > 200) return;
  if (event.kind === "roundabout") {
    const p = project(scene, event.x, event.z);
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
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
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
  for (const object of scene.world) {
    object.z -= step;
    if (object.z < Z_NEAR) respawn(scene.rnd, object);
  }
  drawSky(ctx, scene);
  drawHills(ctx, scene);
  drawGround(ctx, scene);
  drawRoad(ctx, scene);
  const approach = drawJunctions(ctx, scene);
  if (!scene.syntheticLights) drawRealSignals(ctx, scene);
  for (const object of [...scene.world].sort((a, b) => b.z - a.z)) drawObject(ctx, scene, object);
  drawVignette(ctx, scene);
  return approach;
}