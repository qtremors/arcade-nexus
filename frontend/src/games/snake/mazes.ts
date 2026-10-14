export const MAZE_NAMES = [
  "Orchard",
  "Terraces",
  "Islands",
  "Switchbacks",
] as const;
/** A clear perimeter and middle corridor connect every authored section. */
export function buildMaze(cols: number, rows: number, layout: number) {
  const walls: { x: number; y: number }[] = [];
  if (cols < 14 || rows < 12) return walls;
  const cx = Math.floor(cols / 2),
    cy = Math.floor(rows / 2);
  for (let y = 2; y < rows - 2; y++)
    for (let x = 2; x < cols - 2; x++) {
      if (Math.abs(y - cy) <= 1) continue;
      const a = Math.floor(cols / 3),
        b = Math.floor((cols * 2) / 3);
      const top = Math.floor(rows / 3),
        bottom = Math.floor((rows * 2) / 3);
      const blocked =
        layout === 0
          ? (x === a || x === b) && y >= 4 && y < rows - 4
          : layout === 1
            ? (y === top || y === bottom) && Math.abs(x - cx) > 2
            : layout === 2
              ? (x === a || x === a + 1 || x === b || x === b + 1) &&
                (y === top || y === bottom)
              : (x === a && y < cy - 2) || (x === b && y > cy + 2);
      if (blocked) walls.push({ x, y });
    }
  return walls;
}
