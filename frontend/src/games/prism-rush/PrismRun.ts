import { z } from "zod";
import { Random } from "../../sdk/Random";
import type { InputState } from "../../sdk/GameSDK";
export const RHYTHMS = [
  [1, 0, 1, 2, 1, 1],
  [0, 0, 1, 2, 2, 1],
  [2, 1, 0, 1, 2, 1],
  [1, 2, 0, 1, 0, 2],
];
const lane = z.number().int().min(0).max(2);
const row = z.object({
  id: z.number().int().nonnegative(),
  z: z.number().min(-120).max(8),
  safe: lane,
  passed: z.boolean(),
});
const schema = z.object({
  version: z.literal(1),
  rhythm: z.number().int().min(0).max(3).default(0),
  beat: z.number().int().min(0).max(5).default(0),
  lane,
  x: z.number().min(-2.8).max(2.8),
  rows: z.array(row).max(12),
  distance: z.number().nonnegative(),
  score: z.number().int().nonnegative(),
  crystals: z.number().int().nonnegative(),
  lives: z.number().int().min(0).max(3),
  elapsed: z.number().nonnegative(),
  spawn: z.number().min(0).max(2),
  nextId: z.number().int().nonnegative(),
  invulnerable: z.number().min(0).max(1),
  difficulty: z.enum(["easy", "normal", "hard"]),
  random: z.number().int().min(0).max(0xffffffff),
});
/** Durable simulation is independent of WebGL so saves and gate fairness are testable. */
export class PrismRun {
  rhythm = 0;
  beat = 0;
  lane = 1;
  x = 0;
  rows: z.infer<typeof row>[] = [];
  distance = 0;
  score = 0;
  crystals = 0;
  lives = 3;
  elapsed = 0;
  spawn = 0.6;
  nextId = 0;
  invulnerable = 0;
  difficulty: "easy" | "normal" | "hard";
  private random: Random;
  private direction = 0;
  constructor(
    seed?: number,
    difficulty: "easy" | "normal" | "hard" = "normal",
  ) {
    this.random = new Random(seed);
    this.difficulty = difficulty;
  }
  get speed() {
    return (
      Math.min(52, 22 + this.distance / 160) *
      (this.difficulty === "easy" ? 0.8 : this.difficulty === "hard" ? 1.15 : 1)
    );
  }
  update(ms: number, input: InputState): "hit" | "collect" | null {
    if (!this.lives) return null;
    const dt = ms / 1000;
    this.elapsed += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    const direction = Number(input.right) - Number(input.left);
    if (direction && direction !== this.direction)
      this.lane = Math.max(0, Math.min(2, this.lane + direction));
    this.direction = direction;
    const target = (this.lane - 1) * 2.8;
    this.x +=
      Math.sign(target - this.x) * Math.min(Math.abs(target - this.x), 14 * dt);
    const move = this.speed * (input.down ? 0.58 : 1) * dt;
    this.distance += move;
    this.spawn -= dt;
    if (this.spawn <= 0) {
      if (!this.beat)
        this.rhythm = Math.floor(this.random.next() * RHYTHMS.length);
      this.rows.push({
        id: this.nextId++,
        z: -110,
        safe: RHYTHMS[this.rhythm][this.beat],
        passed: false,
      });
      this.beat = (this.beat + 1) % 6;
      this.spawn = 1.65;
    }
    let event: "hit" | "collect" | null = null;
    for (const gate of this.rows) {
      gate.z += move;
      if (!gate.passed && gate.z >= -1.1) {
        gate.passed = true;
        if (Math.abs(this.x - (gate.safe - 1) * 2.8) < 0.85) {
          this.crystals++;
          event = "collect";
        } else if (!this.invulnerable) {
          this.lives--;
          this.invulnerable = 1;
          event = "hit";
        }
      }
    }
    this.rows = this.rows.filter((gate) => gate.z < 8);
    this.score = Math.floor(this.distance) + this.crystals * 100;
    return event;
  }
  getState(): Record<string, unknown> {
    return {
      version: 1,
      rhythm: this.rhythm,
      beat: this.beat,
      lane: this.lane,
      x: this.x,
      rows: this.rows.map((r) => ({ ...r })),
      distance: this.distance,
      score: this.score,
      crystals: this.crystals,
      lives: this.lives,
      elapsed: this.elapsed,
      spawn: this.spawn,
      nextId: this.nextId,
      invulnerable: this.invulnerable,
      difficulty: this.difficulty,
      random: this.random.state,
    };
  }
  setState(state: Record<string, unknown>): void {
    const { random, ...data } = schema.parse(state);
    if (
      new Set(data.rows.map((r) => r.id)).size !== data.rows.length ||
      data.rows.some((r) => r.id >= data.nextId)
    )
      throw new Error("Invalid saved gates");
    Object.assign(this, data);
    this.random = new Random(random);
    this.direction = 0;
  }
}
