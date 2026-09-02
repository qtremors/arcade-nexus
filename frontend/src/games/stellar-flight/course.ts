/** Swept plane crossing avoids skipping gates at high flight speeds. */
export function crossGate(
  before: number[],
  after: number[],
  center: number[],
  normal: number[],
  radius = 25,
): "pass" | "miss" | null {
  const distance = (point: number[]) =>
    point.reduce((sum, n, i) => sum + (n - center[i]) * normal[i], 0);
  const start = distance(before),
    end = distance(after);
  if (start > 0 || end < 0 || end <= start) return null;
  const fraction = -start / (end - start);
  const squared = before.reduce(
    (sum, n, i) => sum + (n + (after[i] - n) * fraction - center[i]) ** 2,
    0,
  );
  return squared <= radius ** 2 ? "pass" : "miss";
}

export const TERRAIN_STEP = 10000 / 64;
/** Height uses the same triangles as the visible mesh, including at tile seams. */
export function terrainHeight(x: number, z: number, map: number): number {
  const sample = (px: number, pz: number) =>
    -50 +
    (map === 1 ? 1.4 : 1) * 110 * Math.sin(px / 360) * Math.cos(pz / 500) +
    30 * Math.sin((px + pz) / 190);
  const x0 = Math.floor(x / TERRAIN_STEP) * TERRAIN_STEP,
    z0 = Math.floor(z / TERRAIN_STEP) * TERRAIN_STEP;
  const fx = (x - x0) / TERRAIN_STEP,
    fz = (z - z0) / TERRAIN_STEP;
  const h00 = sample(x0, z0),
    h10 = sample(x0 + TERRAIN_STEP, z0),
    h01 = sample(x0, z0 + TERRAIN_STEP),
    h11 = sample(x0 + TERRAIN_STEP, z0 + TERRAIN_STEP);
  // PlaneGeometry's diagonal joins (x0, z1) to (x1, z0).
  return fx + fz <= 1
    ? h00 * (1 - fx - fz) + h10 * fx + h01 * fz
    : h11 * (fx + fz - 1) + h10 * (1 - fz) + h01 * (1 - fx);
}
