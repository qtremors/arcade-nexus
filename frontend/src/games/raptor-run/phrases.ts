export type Hazard = "rock" | "cactus" | "bird";
export const PHRASES: { name: string; hazards: Hazard[] }[] = [
  { name: "First footsteps", hazards: ["rock", "cactus", "rock"] },
  { name: "Stone rhythm", hazards: ["rock", "rock", "cactus", "rock"] },
  { name: "Low wings", hazards: ["bird", "bird", "rock"] },
  { name: "Switchback", hazards: ["cactus", "bird", "rock", "bird"] },
  { name: "High and low", hazards: ["bird", "cactus", "bird", "cactus"] },
];
export const BIOMES = [
  { name: "AMBER DUNES", top: "#637993", bottom: "#efc39b", ground: "#514b4e" },
  { name: "FERN VALLEY", top: "#385d68", bottom: "#bad6a7", ground: "#2d5146" },
  { name: "FROST RIDGE", top: "#7088ae", bottom: "#e0edfa", ground: "#708a9e" },
  { name: "EMBER BASIN", top: "#433756", bottom: "#d59b86", ground: "#403139" },
];
/** Clearance includes one full jump plus obstacle width, then a human recovery window. */
export function phraseGap(
  jump: number,
  gravity: number,
  speed: number,
  difficulty: string,
  end: boolean,
) {
  const recovery =
    difficulty === "easy" ? 0.55 : difficulty === "hard" ? 0.3 : 0.42;
  return (
    Math.max(
      1.05,
      (2 * jump) / gravity + 70 / Math.max(200, speed) + recovery,
    ) + (end ? 0.25 : 0)
  );
}
