/** Authored finite boards: no random tiles spawn in daily puzzles. */
export const PUZZLES = [
  {
    name: "Two steps ahead",
    target: 32,
    moves: 4,
    board: [8, 8, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    name: "Bring it together",
    target: 64,
    moves: 6,
    board: [8, 8, 0, 0, 8, 8, 0, 0, 16, 16, 0, 0, 0, 0, 0, 0],
  },
  {
    name: "Four corners",
    target: 64,
    moves: 5,
    board: [16, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 16, 0, 0, 16],
  },
  {
    name: "Staircase",
    target: 64,
    moves: 6,
    board: [4, 4, 8, 0, 0, 8, 8, 0, 0, 0, 16, 16, 0, 0, 0, 0],
  },
  {
    name: "Double stack",
    target: 128,
    moves: 6,
    board: [16, 16, 32, 0, 0, 0, 0, 0, 16, 16, 32, 0, 0, 0, 0, 0],
  },
  {
    name: "Crossing paths",
    target: 128,
    moves: 7,
    board: [16, 0, 0, 16, 0, 16, 16, 0, 0, 16, 16, 0, 16, 0, 0, 16],
  },
] as const;
