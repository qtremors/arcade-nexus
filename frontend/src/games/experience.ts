export interface GameExperience {
  accent: string;
  mood: string;
  goal: string;
  tip: string;
  controls: { action: string; keyboard: string; controller: string }[];
}
const experiences: Record<string, GameExperience> = {
  snake: {
    accent: "#7de8c4",
    mood: "Find your rhythm",
    goal: "Grow your snake. Collect packets and keep an escape route open.",
    tip: "Leave yourself an escape route. Queue your next turn before reaching a corner.",
    controls: [
      {
        action: "Turn",
        keyboard: "Arrows / WASD",
        controller: "D-pad / left stick",
      },
    ],
  },
  "raptor-run": {
    accent: "#ffc68a",
    mood: "One more run",
    goal: "Cross the desert and beat your longest distance.",
    tip: "Jump over rocks and cacti; duck under low birds. Down also brings you back to the ground faster.",
    controls: [
      { action: "Jump", keyboard: "Space / ↑", controller: "A / D-pad up" },
      {
        action: "Duck / fast fall",
        keyboard: "↓ / S",
        controller: "D-pad down",
      },
    ],
  },
  breakout: {
    accent: "#9eb2ff",
    mood: "Make every hit count",
    goal: "Clear three sectors with three lives. Aim with the paddle edges.",
    tip: "The paddle edges change the ball’s angle. Keep the ball above the paddle and find a path through the bricks.",
    controls: [
      {
        action: "Move paddle",
        keyboard: "← → / A D",
        controller: "D-pad / left stick",
      },
      { action: "Launch ball", keyboard: "Space", controller: "A" },
    ],
  },
  "merge-2048": {
    accent: "#d5b5ff",
    mood: "A little room to think",
    goal: "Merge matching tiles to reach 2048. No timer, just your next move.",
    tip: "Keep your largest tile in a corner. Undo is available for your last move.",
    controls: [
      {
        action: "Slide tiles",
        keyboard: "Arrows / WASD",
        controller: "D-pad / left stick",
      },
      { action: "Undo last move", keyboard: "Z", controller: "B" },
    ],
  },
  "stellar-flight": {
    accent: "#8edbf5",
    mood: "Chase the horizon",
    goal: "Finish a twelve-gate course, or explore Earth, Mars, and space in free flight.",
    tip: "Start with gentle turns. Watch ground clearance and line up with the next gate before accelerating.",
    controls: [
      {
        action: "Pitch / roll",
        keyboard: "Arrows / WASD",
        controller: "D-pad / left stick",
      },
      { action: "Yaw", keyboard: "Q / E", controller: "LB / RB" },
      { action: "Throttle", keyboard: "Shift / Ctrl", controller: "RT / LT" },
      {
        action: "Change world",
        keyboard: "M / 1 / 2 / 3 (free flight)",
        controller: "Y (free flight)",
      },
    ],
  },
};
export const getExperience = (slug: string): GameExperience =>
  experiences[slug] ?? {
    accent: "#8edbf5",
    mood: "Ready when you are",
    goal: "Set a new personal best.",
    tip: "Pause any time to check the controls or save your run.",
    controls: [],
  };
