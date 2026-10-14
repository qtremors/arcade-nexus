import { z } from "zod";
import type { Game2DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { Random } from "../../sdk/Random";
import { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../stores/settingsStore";
const finite = z.number().finite();
const body = z.object({
  x: finite.min(0).max(960),
  y: finite.min(0).max(640),
  vx: finite.min(-1000).max(1000),
  vy: finite.min(-1000).max(1000),
});
const rockSchema = body.extend({
  size: z.number().int().min(1).max(3),
  angle: finite,
});
const bulletSchema = body.extend({ life: z.number().min(0).max(2) });
const schema = z.object({
  version: z.literal(1),
  ship: body.extend({ angle: finite }),
  rocks: z.array(rockSchema).max(256),
  bullets: z.array(bulletSchema).max(64),
  score: z.number().int().nonnegative(),
  lives: z.number().int().min(0).max(3),
  wave: z.number().int().min(1),
  invulnerable: z.number().min(0).max(3),
  cooldown: z.number().min(0).max(1),
  intermission: z.number().min(0).max(2),
  elapsed: z.number().nonnegative(),
  difficulty: z.enum(["easy", "normal", "hard"]),
  random: z.number().int().min(0).max(0xffffffff),
});
type Rock = z.infer<typeof rockSchema>;
type Bullet = z.infer<typeof bulletSchema>;
const wrap = (n: number, max: number) => ((n % max) + max) % max;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(
    Math.min(Math.abs(a.x - b.x), 960 - Math.abs(a.x - b.x)),
    Math.min(Math.abs(a.y - b.y), 640 - Math.abs(a.y - b.y)),
  );
export class AsteroidsGame implements Game2DInstance {
  readonly type = "2d" as const;
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
  private feedback = new GameFeedback();
  private thrust = false;
  init(_canvas: HTMLCanvasElement, config: GameConfig): void {
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
      this.score += points;
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
        this.wave++;
        this.intermission = 1.2;
        this.spawnWave();
      }
    }
    return this.lives > 0;
  }
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#090f1f";
    ctx.fillRect(0, 0, 960, 640);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = i % 3 === 0 ? "#64728f" : "#29364e";
      ctx.fillRect((i * 137.7) % 960, (i * 83.3) % 640, 2, 2);
    }
    const drawRock = (rock: Rock, x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rock.angle);
      ctx.strokeStyle = rock.size === 1 ? "#ffbe83" : "#a8b8d0";
      ctx.lineWidth = rock.size === 1 ? 3 : 2;
      ctx.fillStyle = rock.size === 1 ? "#533b30" : "#162238";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5,
          radius = rock.size * 13 * (i % 2 ? 0.85 : 1.08);
        const px = Math.cos(angle) * radius,
          py = Math.sin(angle) * radius;
        if (!i) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    for (const rock of this.rocks)
      for (const dx of [-960, 0, 960])
        for (const dy of [-640, 0, 640])
          if (
            rock.x + dx > -45 &&
            rock.x + dx < 1005 &&
            rock.y + dy > -45 &&
            rock.y + dy < 685
          )
            drawRock(rock, rock.x + dx, rock.y + dy);
    ctx.fillStyle = "#b6f8ff";
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(this.ship.x, this.ship.y);
    ctx.rotate(this.ship.angle);
    if (this.invulnerable > 0) {
      ctx.strokeStyle = "#73e6ed";
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = "#73e6ed";
    ctx.fillStyle = "#122c40";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -11);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (this.thrust) {
      const flame = useSettingsStore.getState().reducedMotion
        ? 23
        : 23 + Math.sin(this.elapsed * 40) * 5;
      ctx.strokeStyle = "#ffbe83";
      ctx.beginPath();
      ctx.moveTo(-11, -5);
      ctx.lineTo(-flame, 0);
      ctx.lineTo(-11, 5);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#090f1fcc";
    ctx.fillRect(0, 0, 960, 84);
    ctx.textAlign = "left";
    ctx.font = "28px Rajdhani, system-ui";
    ctx.fillStyle = "#ffbe83";
    ctx.fillText("ASTEROIDS", 30, 40);
    ctx.font = "20px Rajdhani, system-ui";
    ctx.fillStyle = "#d6e3f5";
    ctx.fillText(
      `WAVE ${this.wave}   ·   ${this.score} POINTS   ·   ${this.rocks.length} ROCKS`,
      30,
      68,
    );
    ctx.textAlign = "right";
    ctx.fillText(`${this.lives} HULLS`, 925, 40);
    ctx.font = "16px Rajdhani, system-ui";
    ctx.fillText("↑ Thrust   ↓ Brake   ← → Turn   Space / A Fire", 925, 67);
    this.feedback.render(ctx);
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
    const { random, ...data } = schema.parse(state);
    Object.assign(this, data);
    this.random = new Random(random);
    this.thrust = false;
    this.feedback.clear();
  }
}
