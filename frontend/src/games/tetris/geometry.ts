export const shapes = [
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
];
// Rotation/landing checks share immutable matrices instead of allocating a rotated
// board for every collision probe and every rendered ghost cell.
export const rotations = shapes.map((shape) => {
  const variants = [shape];
  for (let i = 1; i < 4; i++) {
    const previous = variants[i - 1];
    variants.push(
      previous[0].map((_, x) => previous.map((row) => row[x]).reverse()),
    );
  }
  return variants;
});
