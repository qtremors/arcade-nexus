export interface GameExperience {
  accent: string;
  mood: string;
  goal: string;
  tip: string;
  controls: { action: string; keyboard: string; controller: string }[];
}
const experiences: Record<string, GameExperience> = {
  tetris: {
    accent: "#bda4ff",
    mood: "One piece ahead",
    goal: "Clear full rows. Build your marathon score or finish a 40-line sprint.",
    tip: "The outline shows your landing. Hold a piece once per drop; clearing four lines earns the biggest bonus.",
    controls: [
      {
        action: "Move / soft drop",
        keyboard: "← → / ↓",
        controller: "D-pad / left stick",
      },
      { action: "Rotate", keyboard: "↑ / W", controller: "D-pad up" },
      { action: "Hard drop", keyboard: "Space", controller: "A" },
      { action: "Hold", keyboard: "C / V", controller: "X" },
    ],
  },
  asteroids: {
    accent: "#ffbe83",
    mood: "Stay in motion",
    goal: "Break every asteroid to reach the next wave. You have three lives.",
    tip: "Your ship keeps drifting when you release thrust. Screen edges wrap; small fragments move faster.",
    controls: [
      {
        action: "Turn",
        keyboard: "← → / A D",
        controller: "D-pad / left stick",
      },
      {
        action: "Thrust / brake",
        keyboard: "↑ ↓ / W S",
        controller: "D-pad / left stick",
      },
      { action: "Fire", keyboard: "Space (hold)", controller: "A (hold)" },
    ],
  },
  "prism-rush": {
    accent: "#73e6ed",
    mood: "Read the road",
    goal: "Dodge red barriers and collect gold crystals. Three impacts end the run.",
    tip: "Every gate has a clear lane. Release and press again to change another lane; brake to give yourself time.",
    controls: [
      {
        action: "Change lane",
        keyboard: "← → / A D",
        controller: "D-pad / left stick",
      },
      { action: "Brake", keyboard: "↓ / S", controller: "D-pad down" },
    ],
  },
  snake: {
    accent: "#7de8c4",
    mood: "Find your rhythm",
    goal: "Grow your snake. Collect packets and keep an escape route open.",
    tip: "Leave yourself an escape route. Queue your next turn before a corner. Maze has four layouts; Bonus Sprint adds optional gold packets that expire.",
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
    goal: "Read obstacle sequences across four biomes and beat your longest distance.",
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
    goal: "Clear the classic three-sector campaign or six arcade sectors with timed power-ups.",
    tip: "Aim with the paddle edges. In Arcade, catch W for a wider paddle and M for multiball; watch their countdowns.",
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
    goal: "Reach 2048, then keep merging up to the final 1,048,576 tile. No timer, just your next move.",
    tip: "Keep your largest tile in a corner. Classic lets you undo the last move. Daily puzzles have a move limit and no new tiles; open the board reader for text controls.",
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
      {
        action: "Change contract (resets progress)",
        keyboard: "H",
        controller: "Left stick click",
      },
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
