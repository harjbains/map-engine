export type SimulatedFix = {
  lat: number;
  lon: number;
  bearing: number;
  speedMph: number;
  metresAlong: number;
  remainingMetres: number;
  targetMph: number;
};

type RoadPoint = { lat: number; lon: number };

const MPH_TO_METRES_PER_SECOND = 0.44704;
const METRES_PER_DEGREE_LATITUDE = 111_320;

function haversineMetres(a: RoadPoint, b: RoadPoint): number {
  const latitudeDelta = (b.lat - a.lat) * Math.PI / 180;
  const longitudeDelta = (b.lon - a.lon) * Math.PI / 180;
  const latitudeA = a.lat * Math.PI / 180;
  const latitudeB = b.lat * Math.PI / 180;
  const sin = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(sin), Math.sqrt(1 - sin));
}

function bearingDegrees(a: RoadPoint, b: RoadPoint): number {
  return (Math.atan2(b.lon - a.lon, b.lat - a.lat) * 180 / Math.PI + 360) % 360;
}

export class DriverViewSimulation {
  private readonly points: RoadPoint[];
  private readonly segmentMetres: number[];
  private readonly segmentBearings: number[];
  private readonly segmentMaxMph: number[];
  readonly totalMetres: number;
  private metresAlong = 0;

  constructor(coordinates: Array<[number, number]>, segmentMaxMph: number[]) {
    this.points = coordinates.map(([lon, lat]) => ({ lat, lon }));
    this.segmentMetres = [];
    this.segmentBearings = [];
    this.segmentMaxMph = [];
    let total = 0;
    for (let index = 0; index + 1 < this.points.length; index += 1) {
      const from = this.points[index];
      const to = this.points[index + 1];
      const metres = Math.max(1, haversineMetres(from, to));
      this.segmentMetres.push(metres);
      this.segmentBearings.push(bearingDegrees(from, to));
      this.segmentMaxMph.push(Math.max(1, Math.min(80, segmentMaxMph[index] ?? 30)));
      total += metres;
    }
    this.totalMetres = total;
  }

  get remainingMetres(): number {
    return Math.max(0, this.totalMetres - this.metresAlong);
  }

  reset(): void {
    this.metresAlong = 0;
  }

  advance(seconds: number, priorSpeedMph: number): SimulatedFix | null {
    if (this.totalMetres <= 0 || this.metresAlong >= this.totalMetres) return null;
    const targetMph = this.targetSpeedAt(this.metresAlong);
    const accelerationMphPerSecond = targetMph > priorSpeedMph ? 3.5 : 6;
    const travelSpeed = Math.max(
      0,
      priorSpeedMph + Math.max(-accelerationMphPerSecond * seconds, Math.min(accelerationMphPerSecond * seconds, targetMph - priorSpeedMph)),
    );
    this.metresAlong = Math.min(this.totalMetres, this.metresAlong + travelSpeed * MPH_TO_METRES_PER_SECOND * seconds);
    if (this.metresAlong >= this.totalMetres) return null;
    const position = this.positionAt(this.metresAlong);
    return {
      lat: position.lat,
      lon: position.lon,
      bearing: position.bearing,
      speedMph: Math.round(travelSpeed * 10) / 10,
      metresAlong: this.metresAlong,
      remainingMetres: this.remainingMetres,
      targetMph,
    };
  }

  private segmentIndexAt(metresAlong: number): number {
    let total = 0;
    for (let index = 0; index < this.segmentMetres.length; index += 1) {
      total += this.segmentMetres[index];
      if (metresAlong <= total) return index;
    }
    return Math.max(0, this.segmentMetres.length - 1);
  }

  private targetSpeedAt(metresAlong: number): number {
    if (this.segmentMaxMph.length === 0) return 30;
    return this.segmentMaxMph[this.segmentIndexAt(metresAlong)];
  }

  private positionAt(metresAlong: number): RoadPoint & { bearing: number } {
    if (this.segmentMetres.length === 0) {
      const point = this.points[0] ?? { lat: 0, lon: 0 };
      return { ...point, bearing: 0 };
    }
    const index = this.segmentIndexAt(metresAlong);
    const segmentStart = this.segmentMetres.slice(0, index).reduce((sum, metres) => sum + metres, 0);
    const fraction = Math.max(0, Math.min(1, (metresAlong - segmentStart) / this.segmentMetres[index]));
    const from = this.points[index];
    const to = this.points[index + 1] ?? from;
    return {
      lat: from.lat + (to.lat - from.lat) * fraction,
      lon: from.lon + (to.lon - from.lon) * fraction,
      bearing: this.segmentBearings[index],
    };
  }
}