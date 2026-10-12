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
    mood: "An endless frontier",
    goal: "Endless space racing. Chain race rings, survey sectors, and unlock faster ships.",
    tip: "Rings and close asteroid passes refill boost. Chain clean gates and discover new sectors to level up. Collisions slow you down; your progress stays. Save or Continue to keep your upgrades.",
    controls: [
      {
        action: "Pitch / steer",
        keyboard: "Arrows / WASD",
        controller: "D-pad / left stick",
      },
      { action: "Yaw", keyboard: "Q / E", controller: "LB / RB" },
      { action: "Boost", keyboard: "Shift / Space", controller: "RT / A" },
      { action: "Brake", keyboard: "Ctrl", controller: "LT" },
      { action: "Plot new race ahead", keyboard: "M", controller: "Y" },
      { action: "Switch unlocked ship", keyboard: "V", controller: "X" },
      { action: "Race / survey exploration", keyboard: "N", controller: "B" },
      { action: "Camera view", keyboard: "C", controller: "Right stick click" },
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
