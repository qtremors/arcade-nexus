import { Random } from "../../sdk/Random";

export const SECTOR_SIZE = 2400;
export type Coordinates = [number, number, number];
export interface SpaceBody {
  position: Coordinates;
  radius: number;
}
export interface Sector {
  key: string;
  coordinates: Coordinates;
  name: string;
  color: number;
  asteroids: SpaceBody[];
  planet: SpaceBody | null;
  planetStyle: "terran" | "gas" | "ice";
  beacon: Coordinates;
  landmark: "Relay spire" | "Ring archive" | "Crystal garden";
}
const regions = [
  { name: "Azure Reach", color: 0x66d9ff },
  { name: "Ember Expanse", color: 0xffb36a },
  { name: "Violet Drift", color: 0xbb8aff },
];
export function sectorCoordinates(position: Coordinates): Coordinates {
  return position.map((value) =>
    Math.floor((value + SECTOR_SIZE / 2) / SECTOR_SIZE),
  ) as Coordinates;
}
export function sectorKey(coordinates: Coordinates): string {
  return coordinates.join(":");
}
export function createSector(coordinates: Coordinates, seed: number): Sector {
  const key = sectorKey(coordinates);
  const hash = [...key].reduce(
    (value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0,
    seed >>> 0,
  );
  const random = new Random(hash);
  const region = regions[Math.floor(random.next() * regions.length)];
  const center = coordinates.map((value) => value * SECTOR_SIZE);
  const point = (): Coordinates =>
    center.map(
      (value) => value + (random.next() - 0.5) * SECTOR_SIZE * 0.9,
    ) as Coordinates;
  const asteroids = Array.from({ length: 12 }, () => ({
    position: point(),
    radius: 18 + random.next() * 42,
  }));
  // Keep the initial launch lane and its first gate welcoming.
  const safe = (body: SpaceBody) =>
    coordinates.some((v) => v !== 0) ||
    Math.hypot(body.position[0], body.position[1]) > body.radius + 120;
  const planetStyle =
    key === "0:0:0"
      ? "terran"
      : (["terran", "gas", "ice"] as const)[Math.floor(random.next() * 3)];
  const planet =
    random.next() < 0.23 || key === "0:0:0"
      ? { position: point(), radius: 220 + random.next() * 200 }
      : null;
  if (planet && !safe(planet)) planet.position[0] += 800;
  if (planet && key === "0:0:0") {
    planet.position = [850, -250, 850];
    planet.radius = 360;
  }
  const beacon = center.map(
    (value, i) => value + (i === 1 ? 100 : i === 2 ? 650 : 0),
  ) as Coordinates;
  for (const body of [...asteroids, ...(planet ? [planet] : [])]) {
    const delta = beacon.map((value, i) => value - body.position[i]);
    const distance = Math.hypot(...delta);
    if (distance < body.radius + 120) {
      const factor = (body.radius + 120) / (distance || 1);
      for (let i = 0; i < 3; i++)
        beacon[i] =
          body.position[i] +
          (distance === 0 ? (i === 1 ? 1 : 0) : delta[i]) * factor;
    }
  }
  return {
    key,
    coordinates,
    ...region,
    asteroids: asteroids.filter(safe),
    planet,
    planetStyle,
    beacon,
    landmark: (["Relay spire", "Ring archive", "Crystal garden"] as const)[
      hash % 3
    ],
  };
}
/** Only the surrounding 27 sectors are resident, regardless of trip length. */
export function nearbySectors(position: Coordinates, seed: number): Sector[] {
  const center = sectorCoordinates(position),
    sectors: Sector[] = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++)
        sectors.push(
          createSector([center[0] + x, center[1] + y, center[2] + z], seed),
        );
  return sectors;
}
/** Swept sphere collision catches obstacles even during a boosted frame. */
export function intersectsBody(
  before: Coordinates,
  after: Coordinates,
  body: SpaceBody,
  padding = 4,
): boolean {
  const dx = after[0] - before[0],
    dy = after[1] - before[1],
    dz = after[2] - before[2];
  const bx = body.position[0] - before[0],
    by = body.position[1] - before[1],
    bz = body.position[2] - before[2];
  const length = dx * dx + dy * dy + dz * dz;
  const fraction =
    length === 0
      ? 0
      : Math.max(0, Math.min(1, (bx * dx + by * dy + bz * dz) / length));
  const x = dx * fraction - bx,
    y = dy * fraction - by,
    z = dz * fraction - bz;
  return x * x + y * y + z * z <= (body.radius + padding) ** 2;
}
