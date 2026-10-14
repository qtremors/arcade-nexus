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
import { z } from "zod";
import type { Game2DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../stores/settingsStore";
import { CanvasLayer } from "../../sdk/CanvasLayer";

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

export class SnakeGame implements Game2DInstance {
  readonly type = "2d" as const;

  private ctx!: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

  // Grid
  private cellSize = 28;
  private cols = 0;
  private rows = 0;
  private gridOffsetX = 0;
  private gridOffsetY = 0;

  // Snake
  private snake: Point[] = [];
  private lastTail: Point | null = null;
  private direction: Direction = "right";
  private nextDirection: Direction = "right";
  private turns: Direction[] = [];
  private inputDirection: Direction | null = null;
  private feedback = new GameFeedback();
  private background = new CanvasLayer();

  // Food
  private food: Point = { x: 0, y: 0 };
  private foodPulse = 0;

  // Particles
  private particles: Particle[] = [];

  // Game state
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
  private moveInterval = 120; // ms per move

  // Colors - Zen palette
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

  init(canvas: HTMLCanvasElement, config?: GameConfig): void {
    this.random = new Random(config?.seed);
    this.mode = config?.mode ?? "classic";
    this.elapsed = 0;
    this.cellSize =
      typeof config?.grid_size === "number"
        ? Math.max(20, Math.min(40, config.grid_size))
        : 28;
    this.ctx = canvas.getContext("2d")!;
    this.width = canvas.width;
    this.height = canvas.height;

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
    if (useSettingsStore.getState().reducedMotion) return;
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
    const bindings = useSettingsStore.getState().bindings;
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
      this.score += 30;
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
      this.score += 10;
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

  render(): void {
    const { ctx, width, height } = this;

    this.background.draw(ctx, width, height, this.walls, (layer) => {
      const gradient = layer.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, this.colors.bg1);
      gradient.addColorStop(1, this.colors.bg2);
      layer.fillStyle = gradient;
      layer.fillRect(0, 0, width, height);
      this.renderGrid(layer);
      layer.fillStyle = "#a78bfa";
      for (const wall of this.walls)
        layer.fillRect(
          this.gridOffsetX + wall.x * this.cellSize + 2,
          this.gridOffsetY + wall.y * this.cellSize + 2,
          this.cellSize - 4,
          this.cellSize - 4,
        );
    });
    if (this.mode.startsWith("sprint")) {
      ctx.font = "18px system-ui";
      ctx.fillStyle = "#fff";
      ctx.fillText(
        `${Math.max(0, 60 - Math.floor(this.elapsed / 1000))}s left`,
        110,
        40,
      );
    }

    if (this.mode === "maze") {
      ctx.textAlign = "left";
      ctx.font = "16px Rajdhani, system-ui";
      ctx.fillStyle = "#c4b5fd";
      ctx.fillText(MAZE_NAMES[this.mazeIndex], this.gridOffsetX, height - 18);
    }
    if (this.bonus) {
      const x = this.gridOffsetX + (this.bonus.x + 0.5) * this.cellSize,
        y = this.gridOffsetY + (this.bonus.y + 0.5) * this.cellSize;
      ctx.fillStyle = "#ffd779";
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 10, y);
      ctx.lineTo(x, y + 10);
      ctx.lineTo(x - 10, y);
      ctx.closePath();
      ctx.fill();
      ctx.textAlign = "left";
      ctx.font = "16px Rajdhani, system-ui";
      ctx.fillText(
        `BONUS +30 · ${Math.ceil((this.bonus.expires - this.elapsed) / 1000)}s`,
        this.gridOffsetX,
        height - 18,
      );
    }
    // Food with glow
    this.renderFood();

    // Snake with glow
    this.renderSnake();

    // Particles
    this.renderParticles();

    // Score
    this.renderScore();
    this.feedback.render(ctx);
  }

  private renderGrid(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= this.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(this.gridOffsetX + x * this.cellSize, this.gridOffsetY);
      ctx.lineTo(
        this.gridOffsetX + x * this.cellSize,
        this.gridOffsetY + this.rows * this.cellSize,
      );
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= this.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(this.gridOffsetX, this.gridOffsetY + y * this.cellSize);
      ctx.lineTo(
        this.gridOffsetX + this.cols * this.cellSize,
        this.gridOffsetY + y * this.cellSize,
      );
      ctx.stroke();
    }

    // Border around play area
    ctx.strokeStyle = "rgba(88, 166, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.gridOffsetX,
      this.gridOffsetY,
      this.cols * this.cellSize,
      this.rows * this.cellSize,
    );
  }

  private renderFood(): void {
    const { ctx } = this;
    const x =
      this.gridOffsetX + this.food.x * this.cellSize + this.cellSize / 2;
    const y =
      this.gridOffsetY + this.food.y * this.cellSize + this.cellSize / 2;
    const pulse = useSettingsStore.getState().reducedMotion
      ? 1
      : 1 + Math.sin(this.foodPulse) * 0.15;
    const size = (this.cellSize / 2 - 4) * pulse;

    // Glow
    ctx.shadowColor = this.colors.foodGlow;
    ctx.shadowBlur = 20 * ctx.getTransform().a;

    // Food
    ctx.fillStyle = this.colors.food;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.arc(x - size * 0.2, y - size * 0.2, size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  private renderSnake(): void {
    const { ctx } = this;

    // Linear Interpolation factor (0 to 1)
    const alpha = useSettingsStore.getState().reducedMotion
      ? 1
      : Math.min(1, this.moveTimer / this.moveInterval);

    // Draw segments
    for (let i = 0; i < this.snake.length; i++) {
      const current = this.snake[i];
      let next = this.snake[i + 1];

      // If it's the last segment, interpolate towards lastTail
      if (!next) {
        if (this.lastTail) next = this.lastTail;
        else next = current; // Should't happen ideally
      }

      // Lerp between next (previous position) and current (new position)
      // Visual Head moves from snake[1] to snake[0]
      // Visual Segment i moves from snake[i+1] to snake[i]

      const lx = next.x + (current.x - next.x) * alpha;
      const ly = next.y + (current.y - next.y) * alpha;

      const x = this.gridOffsetX + lx * this.cellSize;
      const y = this.gridOffsetY + ly * this.cellSize;
      const isHead = i === 0;

      // Progress for gradient (0 = tail, 1 = head)
      const progress = (this.snake.length - i) / this.snake.length;

      // Size varies slightly
      const padding = isHead ? 2 : 3;
      const size = this.cellSize - padding * 2;
      const radius = isHead ? size / 2 : size / 3;

      // Glow for head
      if (isHead) {
        ctx.shadowColor = this.colors.snakeGlow;
        ctx.shadowBlur = 15 * ctx.getTransform().a;
      }

      // Color gradient from head to tail
      const opacity = 0.4 + progress * 0.6;
      ctx.fillStyle = isHead
        ? this.colors.snakeHead
        : `rgba(88, 166, 255, ${opacity})`;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x + padding, y + padding, size, size, radius);
      } else {
        ctx.fillRect(x + padding, y + padding, size, size); // Fallback
      }
      ctx.fill();

      ctx.shadowBlur = 0;

      // Head eyes (interpolated)
      if (isHead) {
        const hx = x + this.cellSize / 2;
        const hy = y + this.cellSize / 2;

        ctx.fillStyle = "#fff";
        const eyeOffset = 4;
        const eyeSize = 3;

        // Determine eye direction based on movement
        // Use current direction for simplicity, or interpolate angle
        let ex1 = 0,
          ey1 = 0,
          ex2 = 0,
          ey2 = 0;
        switch (this.direction) {
          case "right":
            ex1 = hx + eyeOffset;
            ey1 = hy - 3;
            ex2 = hx + eyeOffset;
            ey2 = hy + 3;
            break;
          case "left":
            ex1 = hx - eyeOffset;
            ey1 = hy - 3;
            ex2 = hx - eyeOffset;
            ey2 = hy + 3;
            break;
          case "up":
            ex1 = hx - 3;
            ey1 = hy - eyeOffset;
            ex2 = hx + 3;
            ey2 = hy - eyeOffset;
            break;
          case "down":
            ex1 = hx - 3;
            ey1 = hy + eyeOffset;
            ex2 = hx + 3;
            ey2 = hy + eyeOffset;
            break;
        }

        ctx.beginPath();
        ctx.arc(ex1, ey1, eyeSize, 0, Math.PI * 2);
        ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private renderParticles(): void {
    if (useSettingsStore.getState().reducedMotion) return;
    const { ctx } = this;
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderScore(): void {
    const { ctx, width } = this;

    // Score top center
    ctx.fillStyle = this.colors.text;
    ctx.font =
      'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(`${this.score}`, width / 2, 45);
    ctx.textAlign = "left";
    ctx.font = "600 16px Rajdhani, system-ui";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("NEON SNAKE", this.gridOffsetX, 48);
    ctx.textAlign = "right";
    ctx.fillText(
      `PACE ${Math.round((1000 / this.moveInterval) * 10) / 10} / s`,
      width - this.gridOffsetX,
      48,
    );
    ctx.textAlign = "center";

    // Length indicator
    ctx.fillStyle = this.colors.textDim;
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`LENGTH: ${this.snake.length}`, width / 2, 68);
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
    const point = z.object({
      x: z.number().int().nonnegative(),
      y: z.number().int().nonnegative(),
    });
    const direction = z.enum(["up", "down", "left", "right"]);
    const data = z
      .object({
        version: z.literal(1),
        randomState: z.number().int().min(0).max(4294967295).default(42),
        mode: z
          .enum(["classic", "maze", "sprint", "sprint-plus"])
          .default("classic"),
        elapsed: z.number().min(0).max(604800000).default(0),
        mazeIndex: z
          .number()
          .int()
          .min(0)
          .max(MAZE_NAMES.length - 1)
          .default(0),
        bonus: point
          .extend({ expires: z.number().min(0).max(65000) })
          .nullable()
          .default(null),
        bonusAt: z.number().min(10000).max(70000).default(10000),
        bonuses: z.number().int().min(0).max(6).default(0),
        walls: z.array(point).max(400).default([]),
        cellSize: z.number().min(20).max(40).default(28),
        score: z.number().int().nonnegative().max(2147483647),
        snake: z.array(point).min(3).max(10000),
        food: point,
        direction,
        nextDirection: direction,
        cols: z.number().int().min(6).max(200),
        rows: z.number().int().min(6).max(200),
        moveTimer: z.number().nonnegative().max(150),
        moveInterval: z.number().min(60).max(150),
        lastTail: point.nullable(),
        turns: z.array(direction).max(2).default([]),
      })
      .parse(state);
    const occupied = new Set(data.snake.map((p) => `${p.x},${p.y}`));
    if (
      occupied.size !== data.snake.length ||
      [...data.snake, ...data.walls, data.food].some(
        (p) => p.x >= data.cols || p.y >= data.rows,
      ) ||
      occupied.has(`${data.food.x},${data.food.y}`) ||
      data.walls.some(
        (p) =>
          occupied.has(`${p.x},${p.y}`) ||
          (p.x === data.food.x && p.y === data.food.y),
      )
    )
      throw new Error("Invalid Snake save");
    if (
      data.bonus &&
      (data.bonus.x >= data.cols ||
        data.bonus.y >= data.rows ||
        occupied.has(`${data.bonus.x},${data.bonus.y}`) ||
        data.walls.some((p) => p.x === data.bonus!.x && p.y === data.bonus!.y))
    )
      throw new Error("Invalid bonus packet");
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
  destroy(): void {
    this.background.destroy();
  }
}
