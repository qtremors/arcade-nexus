import {
  silentEffects,
  type SimulationEffects,
  type RenderView,
} from "../simulationEffects";
import { checkedScore, checkedCount } from "../../contracts/gameplay";
import { z } from "zod";
import { parseState } from "./codec";
import { PHRASES, phraseGap } from "./phrases";
import { Random } from "../../sdk/Random";
/**
 * Raptor Run - Endless Runner Game
 * Score based on distance, jump over obstacles
 */
import type { GameConfig, InputState } from "../../sdk/GameSDK";

export interface Obstacle {
  x: number;
  width: number;
  height: number;
  type: "cactus" | "rock" | "bird";
  y: number;
  closest?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

export class RaptorSimulation {
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
  private phraseIndex = 0;
  private phraseStep = 0;
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
  private feedback: SimulationEffects;
  constructor(feedback: SimulationEffects = silentEffects) {
    this.feedback = feedback;
  }
  getRenderView() {
    return {
      dayTime: this.dayTime,
      difficulty: this.difficulty,
      distance: this.distance,
      gameOver: this.gameOver,
      gameSpeed: this.gameSpeed,
      groundY: this.groundY,
      height: this.height,
      isDucking: this.isDucking,
      isJumping: this.isJumping,
      nearMisses: this.nearMisses,
      obstacles: this.obstacles,
      particles: this.particles,
      phraseIndex: this.phraseIndex,
      raptorX: this.raptorX,
      raptorY: this.raptorY,
      score: this.score,
      width: this.width,
    } as const;
  }

  configure(width: number, height: number, config?: GameConfig): void {
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
    this.width = width;
    this.height = height;
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
      this.jumps = checkedCount(this.jumps + 1);
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
    const distance = this.distance + moveDist;
    const score = checkedScore(Math.floor(distance / 10));
    this.distance = distance;
    this.score = score;
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
      this.spawnInterval =
        phraseGap(
          this.JUMP_FORCE,
          this.GRAVITY,
          this.gameSpeed,
          this.difficulty,
          this.phraseStep === 0,
        ) * 1000;
    }

    // Update obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      const before = obs.x + obs.width;
      obs.x -= moveDist;
      if (
        before >= this.raptorX &&
        obs.x + obs.width < this.raptorX &&
        (obs.closest ?? 1000) <= 12
      ) {
        this.nearMisses = checkedCount(this.nearMisses + 1);
        this.feedback.burst(150, this.groundY - 100, "#ffd195", "NEAR MISS");
      }
      if (obs.x < -100) {
        this.obstacles.splice(i, 1);
        continue;
      }
      const rTop = this.isDucking ? this.raptorY + 30 : this.raptorY + 5;
      const rBottom = this.raptorY + 55;
      if (
        obs.x + obs.width - 5 > this.raptorX + 10 &&
        obs.x + 5 < this.raptorX + 40
      ) {
        const gap = Math.max(
          obs.y + 5 - rBottom,
          rTop - (obs.y + obs.height - 5),
        );
        if (gap >= 0) obs.closest = Math.min(obs.closest ?? 1000, gap);
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
    if (this.phraseStep === 0)
      this.phraseIndex = Math.floor(
        this.random.next() * (this.score < 200 ? 2 : PHRASES.length),
      );
    const phrase = PHRASES[this.phraseIndex];
    const type = phrase.hazards[this.phraseStep];
    this.phraseStep = (this.phraseStep + 1) % phrase.hazards.length;
    this.pattern = checkedCount(this.pattern + 1);
    const width = type === "bird" ? 40 : type === "cactus" ? 30 : 40;
    const height =
      type === "bird"
        ? 25
        : type === "cactus"
          ? Math.min(64, (this.JUMP_FORCE ** 2 / (2 * this.GRAVITY)) * 0.45)
          : 28;
    const y = this.groundY - height - (type === "bird" ? 30 : 0);

    this.obstacles.push({ x: this.width + 50, width, height, type, y });
  }

  private spawnDust(count: number, x: number, y: number): void {
    if (this.feedback.reducedMotion()) return;
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
      phraseIndex: this.phraseIndex,
      phraseStep: this.phraseStep,
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
    const data = parseState(state);
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
      detail: `${this.getScore()} metres · ${this.jumps} jumps · ${this.nearMisses} near misses`,
    };
  }
  onPause(): void {
    this.jumpHeld = false;
    this.jumpBuffer = 0;
  }
  onResume(): void {}
  destroy(): void {}
}

export type RaptorView = RenderView<
  ReturnType<RaptorSimulation["getRenderView"]>
>;
