/** Gentle authored turns; gate spacing scales with ship speed. */
export const ROUTES = [
  {
    name: "Driftway",
    yaw: [0, 0.08, -0.08, -0.08, 0.08],
    pitch: [0, 0, 0.04, 0, -0.04],
  },
  {
    name: "Ribbon slalom",
    yaw: [0, 0.22, -0.34, 0.34, -0.22],
    pitch: [0, 0, 0, 0, 0],
  },
  {
    name: "Spiral ascent",
    yaw: [0, 0.16, 0.16, 0.16, 0.16],
    pitch: [0, 0.1, 0.1, -0.05, -0.1],
  },
  {
    name: "Canyon weave",
    yaw: [0, -0.18, 0.18, 0.18, -0.18],
    pitch: [0, -0.12, 0.22, -0.22, 0.12],
  },
] as const;
