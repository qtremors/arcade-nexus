import { ARCADE_SECTORS } from "./sectors";
import { Random } from "../../sdk/Random";
import { z } from "zod";
import type { Game2DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../stores/settingsStore";
import { CanvasLayer } from "../../sdk/CanvasLayer";
export class BreakoutGame implements Game2DInstance {
  readonly type = "2d" as const;
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
  private feedback = new GameFeedback();
  private background = new CanvasLayer();
  private extraBalls: { x: number; y: number; vx: number; vy: number }[] = [];
  private pickups: { x: number; y: number; kind: "wide" | "multi" }[] = [];
  private wideTime = 0;
  private multiTime = 0;
  private get stageCount() {
    return this.mode === "arcade" ? ARCADE_SECTORS.length : 3;
  }
  private trail: { x: number; y: number }[] = [];
  init(canvas: HTMLCanvasElement, config: GameConfig): void {
    this.random = new Random(config.seed);
    this.mode = config.mode ?? "classic";
    this.width = canvas.width;
    this.height = canvas.height;
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
        this.score += this.bricks[i] ? 5 : 10;
        if (!this.bricks[i] && this.stage === 3 && i % 7 === 0) {
          for (const neighbor of [i - 1, i + 1])
            if (
              Math.floor(neighbor / 10) === Math.floor(i / 10) &&
              this.bricks[neighbor]
            ) {
              this.bricks[neighbor] = false;
              this.armor[neighbor] = 0;
              this.score += 10;
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
  render(ctx: CanvasRenderingContext2D): void {
    const key = `${this.stage}:${this.bricks.map((active, i) => (active ? this.armor[i] : 0)).join("")}`;
    this.background.draw(ctx, this.width, this.height, key, (layer) =>
      this.paintPlayfield(layer),
    );
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 16px Rajdhani, system-ui";
    ctx.textAlign = "left";
    ctx.fillText("NEON BREAKOUT", 40, 36);
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "700 28px Rajdhani, system-ui";
    ctx.fillText(String(this.score).padStart(4, "0"), 40, 65);
    ctx.textAlign = "center";
    ctx.font = "600 18px Rajdhani, system-ui";
    ctx.fillStyle = "#c4b5fd";
    ctx.fillText(
      `SECTOR 0${this.stage} / 0${this.stageCount}`,
      this.width / 2,
      40,
    );
    ctx.font = "14px JetBrains Mono, monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      this.mode === "arcade"
        ? ARCADE_SECTORS[this.stage - 1].name
        : `${this.bricks.filter(Boolean).length} BLOCKS REMAIN`,
      this.width / 2,
      64,
    );
    ctx.textAlign = "right";
    ctx.fillStyle = "#67e8f9";
    ctx.font = "24px system-ui";
    ctx.fillText(
      "● ".repeat(this.lives) + "○ ".repeat(3 - this.lives),
      this.width - 40,
      52,
    );
    if (!useSettingsStore.getState().reducedMotion)
      this.trail.forEach((point, i) => {
        ctx.globalAlpha = (i / this.trail.length) * 0.4;
        ctx.fillStyle = "#67e8f9";
        ctx.beginPath();
        ctx.arc(
          point.x,
          point.y,
          3 + (i / this.trail.length) * 4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      });
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#67e8f9";
    ctx.fillRect(
      this.paddle - this.paddleWidth / 2,
      this.height - 60,
      this.paddleWidth,
      14,
    );
    ctx.fillStyle = "#ecfeff";
    ctx.fillRect(
      this.paddle - this.paddleWidth / 2 + 4,
      this.height - 58,
      this.paddleWidth - 8,
      3,
    );
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, 8, 0, Math.PI * 2);
    ctx.fill();
    for (const ball of this.extraBalls) {
      ctx.fillStyle = "#ffe9a3";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of this.pickups) {
      ctx.fillStyle = "#ffd779";
      ctx.fillRect(p.x - 13, p.y - 12, 26, 24);
      ctx.fillStyle = "#172035";
      ctx.font = "bold 17px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(p.kind === "wide" ? "W" : "M", p.x, p.y + 6);
    }
    ctx.font = "16px Rajdhani, system-ui";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffd779";
    if (this.mode === "arcade")
      ctx.fillText(
        `WIDE ${Math.ceil(this.wideTime)}s · MULTIBALL ${Math.ceil(this.multiTime)}s`,
        40,
        300,
      );
    if (this.bricks.filter(Boolean).length <= 3 && this.sinceHit > 8000) {
      ctx.fillStyle = "#d0f8ff";
      ctx.textAlign = "center";
      ctx.fillText(
        "CLEANUP ASSIST · Next paddle hit aims at the remaining bricks",
        this.width / 2,
        335,
      );
    }
    this.feedback.render(ctx);
    if (!this.launched) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "600 18px Rajdhani, system-ui";
      ctx.fillText(
        "Move the paddle • Space / A to launch",
        this.width / 2,
        this.height - 22,
      );
    }
  }
  private paintPlayfield(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#17142e");
    gradient.addColorStop(1, "#080d18");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = "#243049";
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.moveTo(this.width / 2 + (i - 8) * 28, 280);
      ctx.lineTo((i - 4) * 120, this.height);
      ctx.stroke();
    }
    for (let y = 310; y < this.height; y += 45) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(this.width - 20, y);
      ctx.stroke();
    }
    const width = (this.width - 80) / 10;
    this.bricks.forEach((active, i) => {
      if (!active) return;
      ctx.fillStyle = `hsl(${180 + Math.floor(i / 10) * 22} 80% 60%)`;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6 * ctx.getTransform().a;
      ctx.fillRect(
        40 + (i % 10) * width,
        95 + Math.floor(i / 10) * 28,
        width - 4,
        22,
      );
      ctx.shadowBlur = 0;
      if (this.armor[i] > 1) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          42 + (i % 10) * width,
          97 + Math.floor(i / 10) * 28,
          width - 8,
          18,
        );
      }
      if (this.stage === 3 && i % 7 === 0) {
        ctx.fillStyle = "#fff";
        ctx.font = "14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(
          "✦",
          40 + ((i % 10) + 0.5) * width,
          112 + Math.floor(i / 10) * 28,
        );
      }
      ctx.fillStyle = "#ffffff50";
      ctx.fillRect(
        40 + (i % 10) * width + 2,
        97 + Math.floor(i / 10) * 28,
        width - 8,
        3,
      );
    });
  }
  destroy(): void {
    this.background.destroy();
  }
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
    const ballSchema = z.object({
      x: z.number().min(-8).max(968),
      y: z.number().min(-8).max(649),
      vx: z.number().min(-600).max(600),
      vy: z.number().min(-600).max(600),
    });
    const data = z
      .object({
        version: z.literal(1),
        extraBalls: z.array(ballSchema).max(2).default([]),
        pickups: z
          .array(
            z.object({
              x: z.number().min(0).max(960),
              y: z.number().min(0).max(660),
              kind: z.enum(["wide", "multi"]),
            }),
          )
          .max(20)
          .default([]),
        wideTime: z.number().min(0).max(12).default(0),
        multiTime: z.number().min(0).max(10).default(0),
        armor: z.array(z.number().int().min(0).max(2)).length(60).optional(),
        elapsed: z.number().min(0).max(604800000).default(0),
        sinceHit: z.number().min(0).max(604800000).default(0),
        randomState: z.number().int().min(0).max(4294967295).default(42),
        mode: z.enum(["classic", "daily", "arcade"]).default("classic"),
        stage: z.number().int().min(1).max(6).default(1),
        paddle: z.number().min(0).max(960),
        ball: z.object({
          x: z.number().min(-8).max(968),
          y: z.number().min(-8).max(649),
          vx: z.number().min(-600).max(600),
          vy: z.number().min(-600).max(600),
        }),
        bricks: z.array(z.boolean()).length(60),
        score: z.number().int().min(0).max(10000),
        lives: z.number().int().min(1).max(3),
        launched: z.boolean(),
        difficulty: z.enum(["easy", "normal", "hard"]),
      })
      .parse(state);
    if (
      data.mode !== "arcade" &&
      (data.stage > 3 ||
        data.extraBalls.length ||
        data.pickups.length ||
        data.wideTime ||
        data.multiTime)
    )
      throw new Error("Arcade power-ups do not belong to campaign saves");
    Object.assign(this, data);
    this.armor = data.armor ?? data.bricks.map((active) => (active ? 1 : 0));
    this.random.state = data.randomState;
    this.actionHeld = false;
    this.trail = [];
    this.feedback.clear();
  }
}
