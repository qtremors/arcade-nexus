import { checkedScore, checkedCount } from "../../contracts/gameplay";
import { parseState, rockSchema, bulletSchema } from "./codec";
import { z } from "zod";
import type { GameConfig, InputState } from "../../sdk/GameSDK";
import { Random } from "../../sdk/Random";
type Rock = z.infer<typeof rockSchema>;
type Bullet = z.infer<typeof bulletSchema>;
const wrap = (n: number, max: number) => ((n % max) + max) % max;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(
    Math.min(Math.abs(a.x - b.x), 960 - Math.abs(a.x - b.x)),
    Math.min(Math.abs(a.y - b.y), 640 - Math.abs(a.y - b.y)),
  );
import { silentEffects, type SimulationEffects } from "../simulationEffects";
export class AsteroidsSimulation {
  private ship = { x: 480, y: 320, vx: 0, vy: 0, angle: -Math.PI / 2 };
  private rocks: Rock[] = [];
  private bullets: Bullet[] = [];
  private score = 0;
  private lives = 3;
  private wave = 1;
  private invulnerable = 2.5;
  private cooldown = 0;
  private intermission = 1.2;
  private elapsed = 0;
  private difficulty: "easy" | "normal" | "hard" = "normal";
  private random = new Random();
  private feedback: SimulationEffects;
  constructor(feedback: SimulationEffects = silentEffects) {
    this.feedback = feedback;
  }
  private thrust = false;
  configure(
    width: number,
    height: number,
    config: Partial<GameConfig> = {},
  ): void {
    void width;
    void height;
    this.random = new Random(config.seed);
    this.difficulty = config.difficulty ?? "normal";
    this.spawnWave();
  }
  private spawnWave(): void {
    const multiplier =
      this.difficulty === "easy" ? 0.75 : this.difficulty === "hard" ? 1.25 : 1;
    for (let i = 0; i < Math.min(12, 3 + this.wave); i++) {
      const angle = this.random.next() * Math.PI * 2;
      const speed =
        (35 + this.random.next() * 35 + Math.min(25, this.wave * 3)) *
        multiplier;
      // New waves enter far from the ship, including across wrapped edges.
      const spawnAngle =
        (i / Math.min(12, 3 + this.wave)) * Math.PI * 2 +
        this.random.next() * 0.5;
      const x = wrap(this.ship.x + Math.cos(spawnAngle) * 320, 960);
      const y = wrap(this.ship.y + Math.sin(spawnAngle) * 260, 640);
      this.rocks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3,
        angle,
      });
    }
    this.feedback.burst(480, 130, "#ffbe83", `WAVE ${this.wave}`);
  }
  update(milliseconds: number, input: InputState): boolean {
    if (!this.lives) return false;
    const dt = milliseconds / 1000;
    this.elapsed += dt;
    this.feedback.update(milliseconds);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.ship.angle += (Number(input.right) - Number(input.left)) * 4 * dt;
    this.ship.angle =
      ((((this.ship.angle + Math.PI) % (Math.PI * 2)) + Math.PI * 2) %
        (Math.PI * 2)) -
      Math.PI;
    this.thrust = input.up;
    if (input.up) {
      this.ship.vx += Math.cos(this.ship.angle) * 245 * dt;
      this.ship.vy += Math.sin(this.ship.angle) * 245 * dt;
    }
    const damping = Math.exp(-(input.down ? 2.8 : 0.12) * dt);
    this.ship.vx *= damping;
    this.ship.vy *= damping;
    const speed = Math.hypot(this.ship.vx, this.ship.vy);
    if (speed > 330) {
      this.ship.vx *= 330 / speed;
      this.ship.vy *= 330 / speed;
    }
    this.ship.x = wrap(this.ship.x + this.ship.vx * dt, 960);
    this.ship.y = wrap(this.ship.y + this.ship.vy * dt, 640);
    if (input.action && this.cooldown === 0) {
      this.bullets.push({
        x: wrap(this.ship.x + Math.cos(this.ship.angle) * 19, 960),
        y: wrap(this.ship.y + Math.sin(this.ship.angle) * 19, 640),
        vx: this.ship.vx + Math.cos(this.ship.angle) * 510,
        vy: this.ship.vy + Math.sin(this.ship.angle) * 510,
        life: 1.1,
      });
      this.cooldown = 0.17;
      this.feedback.sound("hit");
    }
    for (const rock of this.rocks) {
      rock.x = wrap(rock.x + rock.vx * dt, 960);
      rock.y = wrap(rock.y + rock.vy * dt, 640);
      rock.angle += dt * 0.3;
    }
    for (const bullet of this.bullets) {
      bullet.x = wrap(bullet.x + bullet.vx * dt, 960);
      bullet.y = wrap(bullet.y + bullet.vy * dt, 640);
      bullet.life = Math.max(0, bullet.life - dt);
    }
    for (const bullet of this.bullets) {
      if (!bullet.life) continue;
      const index = this.rocks.findIndex(
        (rock) => distance(rock, bullet) < rock.size * 13 + 3,
      );
      if (index < 0) continue;
      const [rock] = this.rocks.splice(index, 1);
      bullet.life = 0;
      const points = rock.size === 3 ? 20 : rock.size === 2 ? 50 : 100;
      this.score = checkedScore(this.score + points);
      this.feedback.burst(rock.x, rock.y, "#ffbe83", `+${points}`);
      this.feedback.sound("collect");
      if (rock.size > 1)
        for (const sign of [-1, 1]) {
          const angle = Math.atan2(rock.vy, rock.vx) + sign * 0.8;
          const speed = Math.min(210, Math.hypot(rock.vx, rock.vy) * 1.4);
          this.rocks.push({
            x: wrap(rock.x + Math.cos(angle) * 10, 960),
            y: wrap(rock.y + Math.sin(angle) * 10, 640),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: rock.size - 1,
            angle,
          });
        }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    if (
      this.invulnerable === 0 &&
      this.rocks.some((rock) => distance(rock, this.ship) < rock.size * 13 + 10)
    ) {
      this.lives--;
      this.feedback.burst(this.ship.x, this.ship.y, "#ff8aa8", "HULL LOST");
      this.feedback.sound("miss");
      this.ship = { x: 480, y: 320, vx: 0, vy: 0, angle: -Math.PI / 2 };
      this.invulnerable = 2.5;
    }
    if (!this.rocks.length) {
      this.intermission = Math.max(0, this.intermission - dt);
      if (!this.intermission) {
        this.wave = checkedCount(this.wave) + 1;
        this.intermission = 1.2;
        this.spawnWave();
      }
    }
    return this.lives > 0;
  }
  getScore() {
    return this.score;
  }
  getMetrics() {
    return { lives: this.lives, sectors: this.wave - 1 };
  }
  getResult() {
    return {
      title: "Lost in the stars",
      detail: `Wave ${this.wave} · ${this.score} points · ${Math.floor(this.elapsed)} seconds survived`,
    };
  }
  getState(): Record<string, unknown> {
    return {
      version: 1,
      ship: { ...this.ship },
      rocks: this.rocks.map((r) => ({ ...r })),
      bullets: this.bullets.map((b) => ({ ...b })),
      score: this.score,
      lives: this.lives,
      wave: this.wave,
      invulnerable: this.invulnerable,
      cooldown: this.cooldown,
      intermission: this.intermission,
      elapsed: this.elapsed,
      difficulty: this.difficulty,
      random: this.random.state,
    };
  }
  setState(state: Record<string, unknown>): void {
    const { random, ...data } = parseState(state);
    Object.assign(this, data);
    this.random = new Random(random);
    this.thrust = false;
    this.feedback.clear();
  }
  destroy() {}
  getRenderView() {
    return {
      bullets: this.bullets,
      elapsed: this.elapsed,
      invulnerable: this.invulnerable,
      lives: this.lives,
      rocks: this.rocks,
      score: this.score,
      ship: this.ship,
      thrust: this.thrust,
      wave: this.wave,
    };
  }
}
export type AsteroidsView = import("../simulationEffects").RenderView<
  ReturnType<AsteroidsSimulation["getRenderView"]>
>;
