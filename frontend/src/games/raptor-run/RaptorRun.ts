import { Random } from "../../sdk/Random";
/**
 * Raptor Run - Endless Runner Game
 * Score based on distance, jump over obstacles
 */
import { z } from "zod";
import type { Game2DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../stores/settingsStore";

interface Obstacle {
  x: number;
  width: number;
  height: number;
  type: "cactus" | "rock" | "bird";
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

export class RaptorRunGame implements Game2DInstance {
  readonly type = "2d" as const;

  private width = 0;
  private height = 0;

  // Physics
  private GRAVITY = 2500;
  private JUMP_FORCE = 850;
  private INITIAL_SPEED = 400;
  private readonly MAX_SPEED = 1000;

  // Raptor state
  private raptorX = 80;
  private raptorY = 0;
  private raptorVelocity = 0;
  private readonly raptorWidth = 50;
  private readonly raptorHeight = 60;
  private groundY = 0;
  private isJumping = false;
  private isDucking = false;
  private legFrame = 0;
  private legTimer = 0;

  // Game state
  private obstacles: Obstacle[] = [];
  private particles: Particle[] = [];
  private gameSpeed = this.INITIAL_SPEED;
  private score = 0;
  private random = new Random();
  private pattern = 0;
  private nearMisses = 0;
  private milestone = 0;
  private jumps = 0;
  private distance = 0;
  private gameOver = false;
  private dayTime = 0;
  private spawnTimer = 0;
  private spawnInterval = 1500;
  private difficulty: "easy" | "normal" | "hard" = "normal";
  private jumpHeld = false;
  private jumpBuffer = 0;
  private feedback = new GameFeedback();

  init(canvas: HTMLCanvasElement, config?: GameConfig): void {
    this.random = new Random(config?.seed);
    this.GRAVITY = z
      .number()
      .min(1800)
      .max(3000)
      .parse(config?.gravity ?? 2500);
    this.JUMP_FORCE = z
      .number()
      .min(700)
      .max(950)
      .parse(config?.jump_force ?? 850);
    this.INITIAL_SPEED = z
      .number()
      .min(250)
      .max(500)
      .parse(config?.initial_speed ?? 400);
    this.width = canvas.width;
    this.height = canvas.height;
    this.groundY = this.height * 0.8;
    if (config?.difficulty) {
      this.difficulty = config.difficulty as "easy" | "normal" | "hard";
    }
    this.reset();
  }

  private reset(): void {
    this.raptorY = this.groundY - this.raptorHeight;
    this.raptorVelocity = 0;
    this.isJumping = false;
    this.isDucking = false;
    this.obstacles = [];
    this.particles = [];
    this.gameSpeed = this.INITIAL_SPEED;
    this.score = 0;
    this.distance = 0;
    this.gameOver = false;
    this.spawnTimer = 0;

    // Difficulty adjustments
    let speedMod = 1.0;
    let spawnMod = 1.0;
    switch (this.difficulty) {
      case "easy":
        speedMod = 0.8;
        spawnMod = 1.2;
        break;
      case "hard":
        speedMod = 1.2;
        spawnMod = 0.8;
        break;
    }

    this.gameSpeed = this.INITIAL_SPEED * speedMod;
    this.spawnInterval = 1500 * spawnMod;
  }

  update(deltaTime: number, input: InputState): boolean {
    if (this.gameOver) return false;

    const dt = deltaTime / 1000;
    this.feedback.update(deltaTime);
    this.dayTime = (this.dayTime + dt * 0.017) % 1;

    // Jump
    const jumpPressed = input.up || input.action;
    if (jumpPressed && !this.jumpHeld) this.jumpBuffer = 0.12;
    this.jumpHeld = jumpPressed;
    if (this.jumpBuffer > 0 && !this.isJumping) {
      this.jumpBuffer = 0;
      this.jumps++;
      this.raptorVelocity = -this.JUMP_FORCE;
      this.isJumping = true;
      this.spawnDust(3, this.raptorX + this.raptorWidth / 2, this.groundY);
      this.feedback.sound("jump");
    }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    // Fast fall
    if (input.down && this.isJumping) {
      this.raptorVelocity += this.GRAVITY * dt;
    }

    this.isDucking = input.down && !this.isJumping;

    // Physics
    this.raptorVelocity += this.GRAVITY * dt;
    this.raptorY += this.raptorVelocity * dt;

    const groundLevel = this.groundY - this.raptorHeight;
    if (this.raptorY >= groundLevel) {
      this.raptorY = groundLevel;
      if (this.isJumping) {
        this.spawnDust(2, this.raptorX + this.raptorWidth / 2, this.groundY);
      }
      this.raptorVelocity = 0;
      this.isJumping = false;
    }

    // Leg animation
    if (!this.isJumping) {
      this.legTimer += dt;
      if (this.legTimer > 0.08) {
        this.legFrame = 1 - this.legFrame;
        this.legTimer = 0;
      }
    }

    // Distance and score
    const moveDist = this.gameSpeed * dt;
    this.distance += moveDist;
    this.score = Math.floor(this.distance / 10);
    if (Math.floor(this.score / 250) > this.milestone) {
      this.milestone = Math.floor(this.score / 250);
      this.feedback.burst(
        this.width / 2,
        180,
        "#ffd195",
        `${this.milestone * 250} METRES`,
      );
      this.feedback.sound("collect");
    }

    // Spawn obstacles
    this.spawnTimer += deltaTime;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnObstacle();
      this.spawnTimer = 0;
      this.spawnInterval = Math.max(
        920,
        Math.max(800, 1500 - this.score * 2) *
          (this.difficulty === "easy"
            ? 1.2
            : this.difficulty === "hard"
              ? 0.8
              : 1),
      );
    }

    // Update obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      const before = obs.x + obs.width;
      obs.x -= moveDist;
      if (
        before >= this.raptorX &&
        obs.x + obs.width < this.raptorX &&
        (this.isJumping || this.isDucking)
      ) {
        this.nearMisses++;
        this.feedback.burst(150, this.groundY - 100, "#ffd195", "CLEAN DODGE");
      }
      if (obs.x < -100) {
        this.obstacles.splice(i, 1);
        continue;
      }
      if (this.checkCollision(obs)) {
        this.gameOver = true;
        this.feedback.sound("miss");
        this.spawnDust(
          15,
          this.raptorX + this.raptorWidth / 2,
          this.raptorY + this.raptorHeight / 2,
        );
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    this.gameSpeed =
      Math.min(this.MAX_SPEED, this.INITIAL_SPEED + this.score * 0.5) *
      (this.difficulty === "easy" ? 0.8 : this.difficulty === "hard" ? 1.2 : 1);
    return !this.gameOver;
  }

  private checkCollision(obs: Obstacle): boolean {
    const rX = this.raptorX + 10;
    const rY = this.isDucking
      ? this.raptorY + this.raptorHeight / 2
      : this.raptorY + 5;
    const rW = this.raptorWidth - 20;
    const rH = this.isDucking
      ? this.raptorHeight / 2 - 5
      : this.raptorHeight - 10;
    const oX = obs.x + 5;
    const oY = obs.y + 5;
    const oW = obs.width - 10;
    const oH = obs.height - 10;
    return rX < oX + oW && rX + rW > oX && rY < oY + oH && rY + rH > oY;
  }

  private spawnObstacle(): void {
    const patterns: Obstacle["type"][][] =
      this.score < 200
        ? [["rock", "cactus", "rock", "cactus"]]
        : [
            ["rock", "cactus", "bird", "rock"],
            ["bird", "rock", "cactus", "bird"],
          ];
    const sequence = patterns[Math.floor(this.random.next() * patterns.length)];
    const type = sequence[this.pattern++ % sequence.length];
    let width = 30,
      height = 50,
      y = this.groundY;

    if (type === "cactus") {
      width = 25 + this.random.next() * 15;
      height = 50 + this.random.next() * 25;
      y = this.groundY - height;
    } else if (type === "rock") {
      width = 35 + this.random.next() * 20;
      height = 25 + this.random.next() * 15;
      y = this.groundY - height;
    } else if (type === "bird") {
      width = 40;
      height = 25;
      const heights = [30, 60, 90];
      y =
        this.groundY -
        heights[Math.floor(this.random.next() * heights.length)] -
        height;
    }
    this.obstacles.push({ x: this.width + 50, width, height, type, y });
  }

  private spawnDust(count: number, x: number, y: number): void {
    if (useSettingsStore.getState().reducedMotion) return;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y,
        vx: (Math.random() - 0.5) * 100 - this.gameSpeed * 0.3,
        vy: -50 - Math.random() * 80,
        life: 0.3 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
      });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const isNight = this.dayTime > 0.5;
    const skyTop = isNight ? "#151b36" : "#637993";
    const skyBottom = isNight ? "#47415e" : "#efc39b";
    const groundColor = isNight ? "#252735" : "#514b4e";

    // Sky
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Sun/Moon
    const celestialY = 155 + Math.sin(this.dayTime * Math.PI * 2) * 40;
    ctx.fillStyle = isNight ? "#e1e5f0" : "#ffe4bb";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(this.width - 100, celestialY, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Layered silhouettes and passing ground marks make speed legible.
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = isNight
        ? ["#20243f", "#26243d", "#302c40"][layer]
        : ["#8e879b", "#726d84", "#53596e"][layer];
      const offset = (this.distance * (0.04 + layer * 0.06)) % 600;
      const base = this.groundY - 70 - (2 - layer) * 65;
      ctx.beginPath();
      ctx.moveTo(-600, this.groundY);
      for (let i = -1; i <= 2; i++) {
        const x = i * 600 - offset;
        ctx.lineTo(x, base);
        ctx.bezierCurveTo(
          x + 50,
          base - 15,
          x + 75,
          base - 90,
          x + 115,
          base - 95,
        );
        ctx.lineTo(x + 205, base - 90);
        ctx.bezierCurveTo(
          x + 250,
          base - 80,
          x + 240,
          base + 10,
          x + 310,
          base + 15,
        );
        ctx.bezierCurveTo(
          x + 395,
          base + 30,
          x + 415,
          base - 45,
          x + 465,
          base - 55,
        );
        ctx.bezierCurveTo(
          x + 540,
          base - 65,
          x + 550,
          base - 15,
          x + 600,
          base,
        );
      }
      ctx.lineTo(this.width, this.groundY);
      ctx.closePath();
      ctx.fill();
    }
    // Ground
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);
    ctx.strokeStyle = isNight ? "#73718a" : "#aaa287";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(this.width, this.groundY);
    ctx.stroke();
    ctx.fillStyle = isNight ? "#545269" : "#807472";
    for (let i = -1; i < 24; i++) {
      const x = i * 50 - (this.distance % 50);
      ctx.fillRect(x, this.groundY + 28 + (i % 3) * 12, 14, 3);
    }
    // Passing ferns and broken rock on the verge share the obstacle scroll speed.
    for (let i = -1; i < 8; i++) {
      const x = i * 180 - (this.distance % 180);
      ctx.strokeStyle = isNight ? "#3c665f" : "#759483";
      ctx.lineWidth = 2;
      for (let leaf = -2; leaf <= 2; leaf++) {
        ctx.beginPath();
        ctx.moveTo(x, this.groundY + 3);
        ctx.quadraticCurveTo(
          x + leaf * 5,
          this.groundY - 16,
          x + leaf * 12,
          this.groundY - 10,
        );
        ctx.stroke();
      }
    }

    // Particles
    ctx.fillStyle = "rgba(200, 180, 150, 0.7)";
    for (const p of this.particles) {
      if (useSettingsStore.getState().reducedMotion) break;
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Obstacles
    for (const obs of this.obstacles) this.drawObstacle(ctx, obs);

    // Raptor
    this.drawRaptor(ctx);

    // Score
    ctx.fillStyle = "#0f172ac9";
    ctx.beginPath();
    ctx.roundRect(30, 24, 900, 70, 12);
    ctx.fill();
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "600 15px Rajdhani, system-ui";
    ctx.textAlign = "left";
    ctx.fillText("RAPTOR RUN / ENDLESS", 50, 49);
    ctx.fillStyle = "#fff";
    ctx.font = "700 30px Rajdhani, system-ui";
    ctx.fillText(`${this.getScore()} m`, 50, 79);
    ctx.textAlign = "right";
    ctx.font = "600 16px Rajdhani, system-ui";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(
      `PACE ${Math.round(this.gameSpeed / 4)}%  ·  ${this.difficulty.toUpperCase()}`,
      910,
      55,
    );
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("SPACE  Jump     ↓  Duck", 910, 78);
    const nearest = this.obstacles
      .filter((o) => o.x + o.width > this.raptorX)
      .sort((a, b) => a.x - b.x)[0];
    if (
      nearest &&
      nearest.x < 480 &&
      nearest.type === "bird" &&
      nearest.y + nearest.height > this.groundY - 55
    ) {
      ctx.fillStyle = "#fee2e2";
      ctx.textAlign = "center";
      ctx.font = "700 20px Rajdhani, system-ui";
      ctx.fillText("↓ DUCK", nearest.x + nearest.width / 2, nearest.y - 18);
    }
    this.feedback.render(ctx);

    // Game over
    if (this.gameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = "#ff6b6b";
      ctx.font = "bold 48px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CRASHED!", this.width / 2, this.height / 2 - 30);
      ctx.fillStyle = "#fff";
      ctx.font = "24px Inter, sans-serif";
      ctx.fillText(
        `Score: ${this.getScore()}`,
        this.width / 2,
        this.height / 2 + 20,
      );
    }
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
    if (obs.type === "cactus") {
      ctx.fillStyle = "#c7a46c";
      ctx.beginPath();
      ctx.roundRect(
        obs.x + obs.width * 0.25,
        obs.y,
        obs.width * 0.5,
        obs.height,
        5,
      );
      ctx.fill();
      ctx.strokeStyle = "#c7a46c";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      for (const side of [-1, 1]) {
        const center = obs.x + obs.width / 2;
        ctx.beginPath();
        ctx.moveTo(center, obs.y + obs.height * 0.55);
        ctx.lineTo(center + side * obs.width * 0.4, obs.y + obs.height * 0.5);
        ctx.lineTo(center + side * obs.width * 0.4, obs.y + obs.height * 0.27);
        ctx.stroke();
      }
      ctx.lineCap = "butt";
      ctx.fillStyle = "#ecd5a0";
      ctx.fillRect(obs.x + obs.width * 0.4, obs.y + 6, 3, obs.height - 12);
    } else if (obs.type === "rock") {
      ctx.fillStyle = "#7f8c8d";
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y + obs.height);
      ctx.lineTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
      ctx.closePath();
      ctx.fill();
    } else if (obs.type === "bird") {
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath();
      ctx.ellipse(
        obs.x + obs.width / 2,
        obs.y + obs.height / 2,
        obs.width / 2,
        obs.height / 3,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      const flap = Math.sin(this.distance * 0.05) * 10;
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(obs.x + 10, obs.y + obs.height / 2);
      ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height / 2 - flap);
      ctx.lineTo(obs.x + obs.width - 10, obs.y + obs.height / 2);
      ctx.stroke();
    }
  }

  private drawRaptor(ctx: CanvasRenderingContext2D): void {
    const x = this.raptorX,
      y = this.isDucking ? this.raptorY + 30 : this.raptorY;
    ctx.fillStyle = "#09131d50";
    ctx.beginPath();
    const shadowSize = Math.max(
      12,
      30 - (this.groundY - this.raptorY - 60) * 0.08,
    );
    ctx.ellipse(x + 25, this.groundY + 2, shadowSize, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, this.isDucking ? 0.5 : 1);
    const stride = this.isJumping ? -4 : Math.sin(this.distance * 0.08) * 6;
    // Far leg and a long counterbalancing tail, behind the torso.
    ctx.strokeStyle = "#8e6648";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(33, 40);
    ctx.lineTo(40 - stride, 52);
    ctx.lineTo(33 - stride, this.isJumping ? 55 : 60);
    ctx.stroke();
    ctx.fillStyle = "#ba8858";
    ctx.beginPath();
    ctx.moveTo(20, 30);
    ctx.bezierCurveTo(-1, 27, -15, 14, -34, 18);
    ctx.bezierCurveTo(-12, 32, 0, 45, 23, 43);
    ctx.fill();
    // Curved back, powerful hips, long neck and forward-facing muzzle.
    ctx.fillStyle = "#efbd7b";
    ctx.beginPath();
    ctx.moveTo(10, 33);
    ctx.bezierCurveTo(9, 15, 21, 17, 27, 14);
    ctx.lineTo(30, 4);
    ctx.quadraticCurveTo(37, -4, 47, 2);
    ctx.lineTo(59, 8);
    ctx.lineTo(57, 19);
    ctx.lineTo(39, 22);
    ctx.lineTo(38, 31);
    ctx.bezierCurveTo(44, 42, 34, 49, 19, 45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffdb9e";
    ctx.beginPath();
    ctx.ellipse(28, 35, 13, 10, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Mouth, teeth, eye ridge and eye stay readable at the logical game size.
    ctx.strokeStyle = "#665344";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(42, 14);
    ctx.lineTo(58, 14);
    ctx.stroke();
    ctx.fillStyle = "#f6f0cf";
    for (const tooth of [46, 51, 56]) {
      ctx.beginPath();
      ctx.moveTo(tooth, 14);
      ctx.lineTo(tooth + 2, 18);
      ctx.lineTo(tooth + 3, 14);
      ctx.fill();
    }
    ctx.fillStyle = "#ecf3d9";
    ctx.beginPath();
    ctx.ellipse(40, 8, 4, 3, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#102b32";
    ctx.fillRect(41, 6, 2, 4);
    ctx.strokeStyle = "#8e6648";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(35, 30);
    ctx.lineTo(43, 36);
    ctx.lineTo(48, 33);
    ctx.stroke();
    // Near leg has a bent knee and a distinct clawed foot.
    ctx.strokeStyle = "#d5a067";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(21, 41);
    ctx.lineTo(14 + stride, 52);
    ctx.lineTo(19 + stride, this.isJumping ? 57 : 60);
    ctx.stroke();
    ctx.strokeStyle = "#d4dda7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18 + stride, this.isJumping ? 57 : 60);
    ctx.lineTo(27 + stride, this.isJumping ? 57 : 60);
    ctx.stroke();
    ctx.fillStyle = "#ba8858";
    for (const scale of [
      [16, 27],
      [21, 24],
      [26, 23],
      [9, 29],
    ]) {
      ctx.beginPath();
      ctx.arc(scale[0], scale[1], 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  getMetrics() {
    return { jumps: this.jumps };
  }

  getScore(): number {
    return Math.max(0, Math.floor(this.score));
  }

  getState(): Record<string, unknown> {
    return structuredClone({
      version: 1,
      randomState: this.random.state,
      pattern: this.pattern,
      nearMisses: this.nearMisses,
      milestone: this.milestone,
      gravity: this.GRAVITY,
      jumpForce: this.JUMP_FORCE,
      initialSpeed: this.INITIAL_SPEED,
      jumps: this.jumps,
      difficulty: this.difficulty,
      score: this.score,
      distance: this.distance,
      raptorY: this.raptorY,
      raptorVelocity: this.raptorVelocity,
      isJumping: this.isJumping,
      isDucking: this.isDucking,
      obstacles: this.obstacles,
      gameSpeed: this.gameSpeed,
      dayTime: this.dayTime,
      spawnTimer: this.spawnTimer,
      spawnInterval: this.spawnInterval,
      jumpBuffer: this.jumpBuffer,
    });
  }
  setState(state: Record<string, unknown>): void {
    const data = z
      .object({
        version: z.literal(1),
        randomState: z.number().int().min(0).max(4294967295).default(42),
        pattern: z.number().int().min(0).max(1000000).default(0),
        nearMisses: z.number().int().min(0).max(1000000).default(0),
        milestone: z.number().int().min(0).max(10000000).default(0),
        gravity: z.number().min(1800).max(3000).default(2500),
        jumpForce: z.number().min(700).max(950).default(850),
        initialSpeed: z.number().min(250).max(500).default(400),
        jumps: z.number().int().min(0).max(1000000),
        difficulty: z.enum(["easy", "normal", "hard"]),
        score: z.number().int().nonnegative().max(2147483647),
        distance: z.number().nonnegative().max(21474836470),
        raptorY: z.number().min(-1000).max(1000),
        raptorVelocity: z.number().min(-2000).max(3000),
        isJumping: z.boolean(),
        isDucking: z.boolean(),
        gameSpeed: z.number().min(0).max(1200),
        dayTime: z.number().min(0).max(1),
        spawnTimer: z.number().min(0).max(2000),
        spawnInterval: z.number().min(600).max(2000),
        jumpBuffer: z.number().min(0).max(0.12).default(0),
        obstacles: z
          .array(
            z.object({
              x: z.number().min(-100).max(1200),
              y: z.number().min(0).max(1000),
              width: z.number().min(1).max(100),
              height: z.number().min(1).max(100),
              type: z.enum(["cactus", "rock", "bird"]),
            }),
          )
          .max(20),
      })
      .parse(state);
    Object.assign(this, data);
    this.random.state = data.randomState;
    this.GRAVITY = data.gravity;
    this.JUMP_FORCE = data.jumpForce;
    this.INITIAL_SPEED = data.initialSpeed;
    this.gameOver = false;
    this.particles = [];
    this.jumpHeld = false;
    this.feedback.clear();
  }
  getResult(): { title: string; detail: string } {
    return {
      title: "Run complete",
      detail: `${this.getScore()} metres · ${this.jumps} jumps · ${this.nearMisses} clean dodges`,
    };
  }
  onPause(): void {
    this.jumpHeld = false;
    this.jumpBuffer = 0;
  }
  onResume(): void {}
  destroy(): void {}
}
