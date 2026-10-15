import { checkedScore } from "../../contracts/gameplay";
import { parseState } from "./codec";
import { ARCADE_SECTORS } from "./sectors";
import { Random } from "../../sdk/Random";
import type { GameConfig, InputState } from "../../sdk/GameSDK";
import { silentEffects, type SimulationEffects } from "../simulationEffects";
export class BreakoutSimulation {
  private width = 960;
  private height = 640;
  private paddle = 480;
  private ball = { x: 480, y: 555, vx: 150, vy: -350 };
  private launched = false;
  private bricks = Array<boolean>(60).fill(true);
  private score = 0;
  private lives = 3;
  private difficulty: "easy" | "normal" | "hard" = "normal";
  private actionHeld = false;
  private stage = 1;
  private armor = Array<number>(60).fill(1);
  private elapsed = 0;
  private sinceHit = 0;
  private random = new Random();
  private mode = "classic";
  private feedback: SimulationEffects;
  constructor(feedback: SimulationEffects = silentEffects) {
    this.feedback = feedback;
  }
  private extraBalls: { x: number; y: number; vx: number; vy: number }[] = [];
  private pickups: { x: number; y: number; kind: "wide" | "multi" }[] = [];
  private wideTime = 0;
  private multiTime = 0;
  private get stageCount() {
    return this.mode === "arcade" ? ARCADE_SECTORS.length : 3;
  }
  private trail: { x: number; y: number }[] = [];
  getInputHints() {
    return { breakout: { ballX: this.ball.x, paddleX: this.paddle } };
  }
  configure(
    width: number,
    height: number,
    config: Partial<GameConfig> = {},
  ): void {
    this.random = new Random(config.seed);
    this.mode = config.mode ?? "classic";
    this.width = width;
    this.height = height;
    this.difficulty = config.difficulty ?? "normal";
    this.setSector();
    this.resetBall();
  }
  private setSector(): void {
    this.bricks = Array.from(
      { length: 60 },
      (_, i) =>
        this.stage === 1 ||
        (this.stage === 2
          ? i % 10 !== 2 && i % 10 !== 7
          : Math.abs((i % 10) - 4.5) + Math.abs(Math.floor(i / 10) - 2.5) < 5),
    );
    if (this.mode === "arcade")
      this.bricks = ARCADE_SECTORS[this.stage - 1].rows
        .join("")
        .split("")
        .map((cell) => cell === "1");
    if (this.mode === "daily")
      this.bricks = this.bricks.map(
        (active, i) => active && (i < 10 || this.random.next() > 0.15),
      );
    this.armor = this.bricks.map((active, i) =>
      !active ? 0 : this.stage > 1 && i % 4 === 0 ? 2 : 1,
    );
  }
  private get ballSpeed(): number {
    const base =
      this.difficulty === "easy" ? 340 : this.difficulty === "hard" ? 460 : 390;
    return Math.min(560, base + (this.stage - 1) * 35 + this.score * 0.07);
  }
  private resetBall(): void {
    this.launched = false;
    this.extraBalls = [];
    this.pickups = [];
    this.wideTime = 0;
    this.multiTime = 0;
    this.ball = {
      x: this.paddle,
      y: this.height - 78,
      vx: this.ballSpeed * 0.35,
      vy: -this.ballSpeed * Math.sqrt(1 - 0.35 ** 2),
    };
    this.trail = [];
  }
  private advanceStage(): boolean {
    if (this.stage === this.stageCount) return false;
    this.stage++;
    this.setSector();
    this.resetBall();
    this.feedback.sound("collect");
    return true;
  }
  private get paddleWidth(): number {
    return (
      (this.difficulty === "easy"
        ? 150
        : this.difficulty === "hard"
          ? 90
          : 120) * (this.wideTime > 0 ? 1.5 : 1)
    );
  }
  update(milliseconds: number, input: InputState): boolean {
    if (!this.lives) return false;
    if (!this.bricks.some(Boolean)) return this.advanceStage();
    this.elapsed += milliseconds;
    this.sinceHit += milliseconds;
    this.feedback.update(milliseconds);
    const dt = milliseconds / 1000;
    this.wideTime = Math.max(0, this.wideTime - dt);
    this.multiTime = Math.max(0, this.multiTime - dt);
    if (!this.multiTime) this.extraBalls = [];
    this.paddle = Math.max(
      this.paddleWidth / 2 + 8,
      Math.min(
        this.width - this.paddleWidth / 2 - 8,
        this.paddle + (Number(input.right) - Number(input.left)) * 600 * dt,
      ),
    );
    if (!this.launched) {
      this.ball.x = this.paddle;
      this.ball.y = this.height - 78;
      if (input.action && !this.actionHeld) this.launched = true;
    }
    this.actionHeld = input.action;
    if (!this.launched) return true;
    const moving = [this.ball, ...this.extraBalls].filter((ball) =>
      this.stepBall(ball, dt),
    );
    if (moving.length) {
      this.ball = moving[0];
      this.extraBalls = moving.slice(1);
    }
    if (!moving.length) {
      this.lives--;
      this.resetBall();
      this.feedback.burst(
        this.paddle,
        this.height - 120,
        "#fb7185",
        "LIFE LOST",
      );
      this.feedback.sound("miss");
    }
    for (const pickup of this.pickups) {
      pickup.y += 180 * dt;
      if (
        pickup.y >= this.height - 72 &&
        pickup.y <= this.height - 45 &&
        Math.abs(pickup.x - this.paddle) <= this.paddleWidth / 2 + 12
      ) {
        if (pickup.kind === "wide") this.wideTime = 12;
        else {
          this.multiTime = 10;
          const angle = Math.atan2(this.ball.vy, this.ball.vx);
          this.extraBalls = [-0.42, 0.42].map((offset) => ({
            x: this.ball.x,
            y: this.ball.y,
            vx: Math.cos(angle + offset) * this.ballSpeed,
            vy: Math.sin(angle + offset) * this.ballSpeed,
          }));
        }
        this.feedback.burst(
          this.paddle,
          this.height - 110,
          "#ffd779",
          pickup.kind === "wide" ? "WIDE PADDLE · 12s" : "MULTIBALL · 10s",
        );
        this.feedback.sound("collect");
        pickup.y = this.height + 50;
      }
    }
    this.pickups = this.pickups.filter((p) => p.y < this.height + 20);
    if (this.launched) {
      this.trail.push({ x: this.ball.x, y: this.ball.y });
      this.trail = this.trail.slice(-12);
    }
    return this.lives > 0 && (this.bricks.some(Boolean) || this.advanceStage());
  }
  private stepBall(
    ball: { x: number; y: number; vx: number; vy: number },
    dt: number,
  ): boolean {
    const previousY = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < 8) {
      ball.x = 8;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x > this.width - 8) {
      ball.x = this.width - 8;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y < 8) {
      ball.y = 8;
      ball.vy = Math.abs(ball.vy);
    }
    const paddleY = this.height - 60;
    if (
      ball.vy > 0 &&
      previousY + 8 <= paddleY &&
      ball.y + 8 >= paddleY &&
      Math.abs(ball.x - this.paddle) <= this.paddleWidth / 2 + 8
    ) {
      const angle =
        (Math.max(
          -1,
          Math.min(1, (ball.x - this.paddle) / (this.paddleWidth / 2)),
        ) *
          Math.PI) /
        3;
      const speed = this.ballSpeed;
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
      ball.y = paddleY - 8;
      if (this.bricks.filter(Boolean).length <= 3 && this.sinceHit > 8000) {
        const at = this.bricks.findIndex(Boolean);
        const dx = 40 + (((at % 10) + 0.5) * (this.width - 80)) / 10 - ball.x;
        const dy = 106 + Math.floor(at / 10) * 28 - ball.y;
        const length = Math.hypot(dx, dy);
        ball.vx = (dx / length) * speed;
        ball.vy = (dy / length) * speed;
      }
      this.feedback.sound("hit");
    }
    const brickWidth = (this.width - 80) / 10;
    for (let i = 0; i < this.bricks.length; i++) {
      if (!this.bricks[i]) continue;
      const x = 40 + (i % 10) * brickWidth,
        y = 95 + Math.floor(i / 10) * 28;
      if (
        ball.x + 8 > x &&
        ball.x - 8 < x + brickWidth - 4 &&
        ball.y + 8 > y &&
        ball.y - 8 < y + 22
      ) {
        this.sinceHit = 0;
        this.armor[i] = Math.max(0, this.armor[i] - 1);
        this.bricks[i] = this.armor[i] > 0;
        this.score = checkedScore(this.score + (this.bricks[i] ? 5 : 10));
        if (!this.bricks[i] && this.stage === 3 && i % 7 === 0) {
          for (const neighbor of [i - 1, i + 1])
            if (
              Math.floor(neighbor / 10) === Math.floor(i / 10) &&
              this.bricks[neighbor]
            ) {
              this.bricks[neighbor] = false;
              this.armor[neighbor] = 0;
              this.score = checkedScore(this.score + 10);
            }
        }
        if (this.mode === "arcade" && !this.bricks[i] && i % 9 === 0)
          this.pickups.push({
            x: x + (brickWidth - 4) / 2,
            y: y + 11,
            kind: (i + this.stage) % 2 === 0 ? "wide" : "multi",
          });
        this.feedback.burst(
          x + (brickWidth - 4) / 2,
          y + 11,
          `hsl(${180 + Math.floor(i / 10) * 22} 80% 65%)`,
          this.bricks[i] ? "+5 · ARMOR" : "+10",
        );
        this.feedback.sound("collect");
        if (previousY + 8 <= y || previousY - 8 >= y + 22) ball.vy *= -1;
        else ball.vx *= -1;
        break;
      }
    }
    return ball.y <= this.height + 8;
  }
  destroy(): void {}
  getScore(): number {
    return this.score;
  }
  getMetrics() {
    const completed =
      this.stage === this.stageCount && !this.bricks.some(Boolean);
    const medal: "gold" | "silver" | "bronze" =
      this.lives === 3 && this.elapsed < 300000
        ? "gold"
        : this.lives >= 2
          ? "silver"
          : "bronze";
    return {
      sectors: completed ? this.stageCount : this.stage - 1,
      lives: this.lives,
      completed,
      ...(completed ? { medal } : {}),
    };
  }
  getResult(): { title: string; detail: string } {
    return {
      title: this.bricks.some(Boolean) ? "Run complete" : "All sectors cleared",
      detail: `Sector ${this.stage} of ${this.stageCount} · ${this.score} points · ${Math.floor(this.elapsed / 1000)}s${this.getMetrics().medal ? ` · ${this.getMetrics().medal} medal` : ""}`,
    };
  }
  getState(): Record<string, unknown> {
    return {
      version: 1,
      armor: [...this.armor],
      extraBalls: this.extraBalls.map((b) => ({ ...b })),
      pickups: this.pickups.map((p) => ({ ...p })),
      wideTime: this.wideTime,
      multiTime: this.multiTime,
      elapsed: this.elapsed,
      sinceHit: this.sinceHit,
      randomState: this.random.state,
      mode: this.mode,
      stage: this.stage,
      paddle: this.paddle,
      ball: { ...this.ball },
      bricks: [...this.bricks],
      score: this.score,
      lives: this.lives,
      launched: this.launched,
      difficulty: this.difficulty,
    };
  }
  setState(state: Record<string, unknown>): void {
    const data = parseState(state);
    Object.assign(this, data);
    this.armor = data.armor ?? data.bricks.map((active) => (active ? 1 : 0));
    this.random.state = data.randomState;
    this.actionHeld = false;
    this.trail = [];
    this.feedback.clear();
  }
  getRenderView() {
    return {
      armor: this.armor,
      ball: this.ball,
      bricks: this.bricks,
      extraBalls: this.extraBalls,
      height: this.height,
      launched: this.launched,
      lives: this.lives,
      mode: this.mode,
      multiTime: this.multiTime,
      paddle: this.paddle,
      paddleWidth: this.paddleWidth,
      pickups: this.pickups,
      score: this.score,
      sinceHit: this.sinceHit,
      stage: this.stage,
      stageCount: this.stageCount,
      trail: this.trail,
      wideTime: this.wideTime,
      width: this.width,
    };
  }
}
export type BreakoutView = import("../simulationEffects").RenderView<
  ReturnType<BreakoutSimulation["getRenderView"]>
>;
