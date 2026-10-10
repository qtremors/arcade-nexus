import { z } from "zod";
import type { Game2DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../stores/settingsStore";
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
  private feedback = new GameFeedback();
  private trail: { x: number; y: number }[] = [];
  init(canvas: HTMLCanvasElement, config: GameConfig): void {
    this.width = canvas.width;
    this.height = canvas.height;
    this.difficulty = config.difficulty ?? "normal";
    this.resetBall();
  }
  private get ballSpeed(): number {
    const base =
      this.difficulty === "easy" ? 340 : this.difficulty === "hard" ? 460 : 390;
    return Math.min(560, base + (this.stage - 1) * 35 + this.score * 0.07);
  }
  private resetBall(): void {
    this.launched = false;
    this.ball = {
      x: this.paddle,
      y: this.height - 78,
      vx: this.ballSpeed * 0.35,
      vy: -this.ballSpeed * Math.sqrt(1 - 0.35 ** 2),
    };
    this.trail = [];
  }
  private advanceStage(): boolean {
    if (this.stage === 3) return false;
    this.stage++;
    this.bricks = Array.from({ length: 60 }, (_, i) =>
      this.stage === 2
        ? i % 10 !== 2 && i % 10 !== 7
        : Math.abs((i % 10) - 4.5) + Math.abs(Math.floor(i / 10) - 2.5) < 5,
    );
    this.resetBall();
    this.feedback.sound("collect");
    return true;
  }
  private get paddleWidth(): number {
    return this.difficulty === "easy"
      ? 150
      : this.difficulty === "hard"
        ? 90
        : 120;
  }
  update(milliseconds: number, input: InputState): boolean {
    if (!this.lives) return false;
    if (!this.bricks.some(Boolean)) return this.advanceStage();
    this.feedback.update(milliseconds);
    const dt = milliseconds / 1000;
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
    const previousY = this.ball.y;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    if (this.ball.x < 8) {
      this.ball.x = 8;
      this.ball.vx = Math.abs(this.ball.vx);
    }
    if (this.ball.x > this.width - 8) {
      this.ball.x = this.width - 8;
      this.ball.vx = -Math.abs(this.ball.vx);
    }
    if (this.ball.y < 8) {
      this.ball.y = 8;
      this.ball.vy = Math.abs(this.ball.vy);
    }
    const paddleY = this.height - 60;
    if (
      this.ball.vy > 0 &&
      previousY + 8 <= paddleY &&
      this.ball.y + 8 >= paddleY &&
      Math.abs(this.ball.x - this.paddle) <= this.paddleWidth / 2 + 8
    ) {
      const angle =
        (Math.max(
          -1,
          Math.min(1, (this.ball.x - this.paddle) / (this.paddleWidth / 2)),
        ) *
          Math.PI) /
        3;
      const speed = this.ballSpeed;
      this.ball.vx = Math.sin(angle) * speed;
      this.ball.vy = -Math.cos(angle) * speed;
      this.ball.y = paddleY - 8;
      this.feedback.sound("hit");
    }
    const brickWidth = (this.width - 80) / 10;
    for (let i = 0; i < this.bricks.length; i++) {
      if (!this.bricks[i]) continue;
      const x = 40 + (i % 10) * brickWidth,
        y = 95 + Math.floor(i / 10) * 28;
      if (
        this.ball.x + 8 > x &&
        this.ball.x - 8 < x + brickWidth - 4 &&
        this.ball.y + 8 > y &&
        this.ball.y - 8 < y + 22
      ) {
        this.bricks[i] = false;
        this.score += 10;
        this.feedback.burst(
          x + (brickWidth - 4) / 2,
          y + 11,
          `hsl(${180 + Math.floor(i / 10) * 22} 80% 65%)`,
          "+10",
        );
        this.feedback.sound("collect");
        if (previousY + 8 <= y || previousY - 8 >= y + 22) this.ball.vy *= -1;
        else this.ball.vx *= -1;
        break;
      }
    }
    if (this.ball.y > this.height + 8) {
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
    if (this.launched) {
      this.trail.push({ x: this.ball.x, y: this.ball.y });
      this.trail = this.trail.slice(-12);
    }
    return this.lives > 0 && (this.bricks.some(Boolean) || this.advanceStage());
  }
  render(ctx: CanvasRenderingContext2D): void {
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
    ctx.fillText(`SECTOR 0${this.stage} / 03`, this.width / 2, 40);
    ctx.font = "14px JetBrains Mono, monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      `${this.bricks.filter(Boolean).length} BLOCKS REMAIN`,
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
    const width = (this.width - 80) / 10;
    this.bricks.forEach((active, i) => {
      if (!active) return;
      ctx.fillStyle = `hsl(${180 + Math.floor(i / 10) * 22} 80% 60%)`;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.fillRect(
        40 + (i % 10) * width,
        95 + Math.floor(i / 10) * 28,
        width - 4,
        22,
      );
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff50";
      ctx.fillRect(
        40 + (i % 10) * width + 2,
        97 + Math.floor(i / 10) * 28,
        width - 8,
        3,
      );
    });
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
  getScore(): number {
    return this.score;
  }
  getResult(): { title: string; detail: string } {
    return {
      title: this.bricks.some(Boolean) ? "Run complete" : "All sectors cleared",
      detail: `Sector ${this.stage} of 3 · ${this.score} points`,
    };
  }
  getState(): Record<string, unknown> {
    return {
      version: 1,
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
    const data = z
      .object({
        version: z.literal(1),
        stage: z.number().int().min(1).max(3).default(1),
        paddle: z.number().min(0).max(960),
        ball: z.object({
          x: z.number().min(-8).max(968),
          y: z.number().min(-8).max(649),
          vx: z.number().min(-600).max(600),
          vy: z.number().min(-600).max(600),
        }),
        bricks: z.array(z.boolean()).length(60),
        score: z.number().int().min(0).max(1800),
        lives: z.number().int().min(1).max(3),
        launched: z.boolean(),
        difficulty: z.enum(["easy", "normal", "hard"]),
      })
      .parse(state);
    Object.assign(this, data);
    this.actionHeld = false;
    this.trail = [];
    this.feedback.clear();
  }
}
