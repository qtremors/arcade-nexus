import { checkedScore } from "../../contracts/gameplay";
import { parseState } from "./codec";
import { buildMaze, MAZE_NAMES } from "./mazes";
import { Random } from "../../sdk/Random";
/**
 * Zen Snake - Minimalist Snake with Premium Aesthetics
 *
 * Features:
 * - Soft gradient colors and glow effects
 * - Smooth segment animations
 * - Particle effects on food collection
 * - Calming visual feedback
 * - Premium UI/UX
 */
import type { GameConfig, InputState } from "../../sdk/GameSDK";

interface Point {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

type Direction = "up" | "down" | "left" | "right";

import { silentEffects, type SimulationEffects } from "../simulationEffects";
export class SnakeSimulation {
  private width = 0;
  private height = 0;
  private cellSize = 28;
  private cols = 0;
  private rows = 0;
  private gridOffsetX = 0;
  private gridOffsetY = 0;
  private snake: Point[] = [];
  private lastTail: Point | null = null;
  private direction: Direction = "right";
  private nextDirection: Direction = "right";
  private turns: Direction[] = [];
  private inputDirection: Direction | null = null;
  private feedback: SimulationEffects;
  private bindings: () => Record<string, string>;
  constructor(
    feedback: SimulationEffects = silentEffects,
    bindings: () => Record<string, string> = () => ({}),
  ) {
    this.feedback = feedback;
    this.bindings = bindings;
  }
  private food: Point = { x: 0, y: 0 };
  private foodPulse = 0;
  private particles: Particle[] = [];
  private score = 0;
  private random = new Random();
  private mode = "classic";
  private elapsed = 0;
  private cause = "Run complete";
  private walls: Point[] = [];
  private mazeIndex = 0;
  private bonus: (Point & { expires: number }) | null = null;
  private bonusAt = 10000;
  private bonuses = 0;
  private gameOver = false;
  private moveTimer = 0;
  private moveInterval = 120;
  private readonly colors = {
    bg1: "#0d1117",
    bg2: "#161b22",
    grid: "rgba(88, 166, 255, 0.04)", // Even subtler grid
    snake: "#58a6ff",
    snakeHead: "#79c0ff",
    snakeGlow: "rgba(88, 166, 255, 0.4)",
    food: "#f778ba",
    foodGlow: "rgba(247, 120, 186, 0.5)",
    text: "rgba(255, 255, 255, 0.9)",
    textDim: "rgba(255, 255, 255, 0.4)",
  };
  getInputHints() {
    return {
      snake: {
        head: this.snake[0],
        direction: this.direction,
        cols: this.cols,
        rows: this.rows,
      },
    };
  }
  configure(width: number, height: number, config?: GameConfig): void {
    this.random = new Random(config?.seed);
    this.mode = config?.mode ?? "classic";
    this.elapsed = 0;
    this.cellSize =
      typeof config?.grid_size === "number"
        ? Math.max(20, Math.min(40, config.grid_size))
        : 28;
    this.width = width;
    this.height = height;

    const baseInterval =
      typeof config?.initial_speed === "number"
        ? Math.max(80, Math.min(120, config.initial_speed))
        : 120;
    this.moveInterval =
      baseInterval *
      (config?.difficulty === "easy"
        ? 1.25
        : config?.difficulty === "hard"
          ? 0.75
          : 1);

    // Calculate grid
    this.calculateGrid();
    this.mazeIndex =
      this.mode === "maze"
        ? Math.floor(this.random.next() * MAZE_NAMES.length)
        : 0;
    this.walls =
      this.mode === "maze"
        ? buildMaze(this.cols, this.rows, this.mazeIndex)
        : [];
    this.startNewGame();
  }
  private calculateGrid(): void {
    // Use most of the screen
    const padding = 60;
    const availWidth = Math.max(this.cellSize * 6, this.width - padding * 2);
    const availHeight = Math.max(this.cellSize * 6, this.height - padding * 2);

    this.cols = Math.floor(availWidth / this.cellSize);
    this.rows = Math.floor(availHeight / this.cellSize);

    // Center the grid
    this.gridOffsetX = (this.width - this.cols * this.cellSize) / 2;
    this.gridOffsetY = (this.height - this.rows * this.cellSize) / 2;
  }
  private startNewGame(): void {
    const centerX = Math.floor(this.cols / 2);
    const centerY = Math.floor(this.rows / 2);

    this.snake = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
    ];
    this.lastTail = { x: centerX - 3, y: centerY };

    this.direction = "right";
    this.nextDirection = "right";
    this.score = 0;
    this.gameOver = false;
    this.moveTimer = 0;
    this.particles = [];

    this.spawnFood();
  }
  private spawnFood(): void {
    if (
      this.bonus &&
      this.snake.length + this.walls.length + 1 >= this.cols * this.rows
    )
      this.bonus = null;
    const empty: Point[] = [];
    const occupied = new Set(
      [...this.snake, ...this.walls, ...(this.bonus ? [this.bonus] : [])].map(
        (p) => `${p.x},${p.y}`,
      ),
    );
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.cols; x++) {
        if (!occupied.has(`${x},${y}`)) empty.push({ x, y });
      }
    if (!empty.length) {
      this.gameOver = true;
      return;
    }
    this.food = empty[Math.floor(this.random.next() * empty.length)];
  }
  private spawnParticles(x: number, y: number): void {
    if (this.feedback.reducedMotion()) return;
    const screenX = this.gridOffsetX + x * this.cellSize + this.cellSize / 2;
    const screenY = this.gridOffsetY + y * this.cellSize + this.cellSize / 2;

    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x: screenX,
        y: screenY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        color: i % 2 === 0 ? this.colors.food : this.colors.snake,
        size: 3 + Math.random() * 4,
      });
    }
  }
  update(dt: number, input: InputState): boolean {
    if (this.gameOver) return false;
    this.elapsed += dt;
    if (this.mode.startsWith("sprint") && this.elapsed >= 60000) {
      this.cause = "Sprint complete";
      this.gameOver = true;
      return false;
    }
    this.feedback.update(dt);
    if (this.bonus && this.elapsed >= this.bonus.expires) this.bonus = null;
    if (this.mode === "sprint-plus" && this.elapsed >= this.bonusAt) {
      this.bonusAt += 10000;
      const cells: Point[] = [];
      for (let y = 0; y < this.rows; y++)
        for (let x = 0; x < this.cols; x++)
          if (
            !(this.food.x === x && this.food.y === y) &&
            !this.snake.some((p) => p.x === x && p.y === y) &&
            Math.abs(x - this.snake[0].x) + Math.abs(y - this.snake[0].y) >= 6
          )
            cells.push({ x, y });
      if (cells.length)
        this.bonus = {
          ...cells[Math.floor(this.random.next() * cells.length)],
          expires: this.elapsed + 4500,
        };
    }

    // Handle input
    const requested: Direction | null = input.up
      ? "up"
      : input.down
        ? "down"
        : input.left
          ? "left"
          : input.right
            ? "right"
            : null;
    const opposite: Record<Direction, Direction> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };
    const bindings = this.bindings();
    const defaults: Record<Direction, string[]> = {
      up: ["ArrowUp", "KeyW"],
      down: ["ArrowDown", "KeyS"],
      left: ["ArrowLeft", "KeyA"],
      right: ["ArrowRight", "KeyD"],
    };
    const pressed = (input.pressed ?? [])
      .map((code) =>
        (Object.keys(defaults) as Direction[]).find((direction) =>
          bindings[direction]
            ? code === bindings[direction]
            : defaults[direction].includes(code),
        ),
      )
      .filter((direction): direction is Direction => !!direction);
    for (const turn of pressed.length
      ? pressed
      : requested && requested !== this.inputDirection
        ? [requested]
        : []) {
      const last = this.turns.at(-1) ?? this.direction;
      if (turn !== last && turn !== opposite[last] && this.turns.length < 2)
        this.turns.push(turn);
    }
    this.inputDirection = requested;
    this.nextDirection = this.turns[0] ?? this.nextDirection;

    // Update food pulse
    this.foodPulse += dt * 0.005;

    // Update particles
    this.particles = this.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.life -= dt / 1000;
      return p.life > 0;
    });

    // Move timer
    this.moveTimer += dt;
    if (this.moveTimer < this.moveInterval) return true;
    this.moveTimer -= this.moveInterval;

    // Apply direction
    this.direction = this.turns.shift() ?? this.nextDirection;
    this.nextDirection = this.turns[0] ?? this.direction;

    // Calculate new head position
    const head = { ...this.snake[0] };
    switch (this.direction) {
      case "up":
        head.y--;
        break;
      case "down":
        head.y++;
        break;
      case "left":
        head.x--;
        break;
      case "right":
        head.x++;
        break;
    }

    // Check wall collision
    if (
      head.x < 0 ||
      head.x >= this.cols ||
      head.y < 0 ||
      head.y >= this.rows ||
      this.walls.some((p) => p.x === head.x && p.y === head.y)
    ) {
      this.cause = "Watch the walls";
      this.gameOver = true;
      return false;
    }

    // Check self collision
    const eating = head.x === this.food.x && head.y === this.food.y;
    if (
      (eating ? this.snake : this.snake.slice(0, -1)).some(
        (s) => s.x === head.x && s.y === head.y,
      )
    ) {
      this.cause = "Leave an escape route";
      this.gameOver = true;
      return false;
    }

    // Add new head
    this.snake.unshift(head);

    if (this.bonus && head.x === this.bonus.x && head.y === this.bonus.y) {
      this.score = checkedScore(this.score + 30);
      this.bonuses++;
      this.bonus = null;
      this.feedback.sound("collect");
      this.feedback.burst(
        this.gridOffsetX + head.x * this.cellSize + 14,
        this.gridOffsetY + head.y * this.cellSize,
        "#ffd779",
        "+30 BONUS",
      );
    }
    // Check food
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score = checkedScore(this.score + 10);
      this.feedback.sound("collect");
      this.feedback.burst(
        this.gridOffsetX + head.x * this.cellSize + 14,
        this.gridOffsetY + head.y * this.cellSize - 10,
        "#f9a8d4",
        "+10",
      );
      this.spawnParticles(this.food.x, this.food.y);
      this.spawnFood();
      // Speed up slightly
      this.moveInterval = Math.max(60, this.moveInterval - 2);
      // Don't remove tail (grow)
      // But we need to update lastTail for smooth lerp continuity if we didn't move it?
      // Actually if we grow, the "tail" stays put. So lastTail should equal current tail.
      this.lastTail = { ...this.snake[this.snake.length - 1] };
    } else {
      // Remove tail
      this.lastTail = this.snake.pop() || null;
    }

    return !this.gameOver;
  }
  getScore(): number {
    return this.score;
  }
  getState(): Record<string, unknown> {
    return structuredClone({
      version: 1,
      randomState: this.random.state,
      mode: this.mode,
      elapsed: this.elapsed,
      walls: this.walls,
      mazeIndex: this.mazeIndex,
      bonus: this.bonus,
      bonusAt: this.bonusAt,
      bonuses: this.bonuses,
      cellSize: this.cellSize,
      score: this.score,
      snake: this.snake,
      food: this.food,
      direction: this.direction,
      nextDirection: this.nextDirection,
      cols: this.cols,
      rows: this.rows,
      moveTimer: this.moveTimer,
      moveInterval: this.moveInterval,
      lastTail: this.lastTail,
      turns: this.turns,
    });
  }
  setState(state: Record<string, unknown>): void {
    const data = parseState(state);
    this.random.state = data.randomState;
    this.mode = data.mode;
    this.elapsed = data.elapsed;

    this.walls = data.walls;
    this.mazeIndex = data.mazeIndex;
    this.bonus = data.bonus;
    this.bonusAt = data.bonusAt;
    this.bonuses = data.bonuses;
    this.cellSize = data.cellSize;
    this.cols = data.cols;
    this.rows = data.rows;
    this.gridOffsetX = (this.width - this.cols * this.cellSize) / 2;
    this.gridOffsetY = (this.height - this.rows * this.cellSize) / 2;
    this.score = data.score;
    this.snake = data.snake;
    this.food = data.food;
    this.direction = data.direction;
    this.nextDirection = data.nextDirection;
    this.turns = data.turns;
    this.inputDirection = null;
    this.moveTimer = data.moveTimer;
    this.moveInterval = data.moveInterval;
    this.lastTail = data.lastTail;
    this.gameOver = false;
    this.particles = [];
    this.feedback.clear();
  }
  getResult(): { title: string; detail: string } {
    return {
      title:
        this.snake.length === this.cols * this.rows
          ? "Grid completed"
          : this.cause,
      detail: `${this.score} points · Length ${this.snake.length}${this.mode === "sprint-plus" ? ` · ${this.bonuses} bonus packets` : ""}`,
    };
  }
  onPause(): void {}
  onResume(): void {}
  destroy(): void {}
  getRenderView() {
    return {
      bonus: this.bonus,
      cellSize: this.cellSize,
      colors: this.colors,
      cols: this.cols,
      direction: this.direction,
      elapsed: this.elapsed,
      food: this.food,
      foodPulse: this.foodPulse,
      gridOffsetX: this.gridOffsetX,
      gridOffsetY: this.gridOffsetY,
      height: this.height,
      lastTail: this.lastTail,
      mazeIndex: this.mazeIndex,
      mode: this.mode,
      moveInterval: this.moveInterval,
      moveTimer: this.moveTimer,
      particles: this.particles,
      rows: this.rows,
      score: this.score,
      snake: this.snake,
      walls: this.walls,
      width: this.width,
    };
  }
}
export type SnakeView = import("../simulationEffects").RenderView<
  ReturnType<SnakeSimulation["getRenderView"]>
>;
