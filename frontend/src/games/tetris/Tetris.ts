import { z } from "zod";
import type { Game2DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { Random } from "../../sdk/Random";
import { GameFeedback } from "../feedback";

const shapes = [
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
];
const colors = [
  "#73e6ed",
  "#f8d477",
  "#bda4ff",
  "#7de8ad",
  "#ff8aa8",
  "#87aaff",
  "#ffbe83",
];
const kind = z.number().int().min(0).max(6);
const count = z.number().int().nonnegative();
const schema = z.object({
  version: z.literal(1),
  board: z.array(z.array(z.number().int().min(0).max(7)).length(10)).length(20),
  piece: kind,
  rotation: z.number().int().min(0).max(3),
  x: z.number().int().min(-3).max(9),
  y: z.number().int().min(-4).max(19),
  queue: z.array(kind).min(3).max(14),
  held: kind.nullable(),
  canHold: z.boolean(),
  score: count,
  lines: count,
  elapsed: z.number().nonnegative(),
  fall: z.number().nonnegative(),
  lock: z.number().nonnegative(),
  resets: count.max(12),
  terminal: z.boolean(),
  mode: z.enum(["marathon", "sprint"]),
  difficulty: z.enum(["easy", "normal", "hard"]),
  random: count.max(0xffffffff),
});

export class TetrisGame implements Game2DInstance {
  readonly type = "2d" as const;
  private board = Array.from({ length: 20 }, () => Array<number>(10).fill(0));
  private piece = 0;
  private rotation = 0;
  private x = 3;
  private y = -1;
  private queue: number[] = [];
  private held: number | null = null;
  private canHold = true;
  private score = 0;
  private lines = 0;
  private elapsed = 0;
  private fall = 0;
  private lock = 0;
  private resets = 0;
  private terminal = false;
  private mode: "marathon" | "sprint" = "marathon";
  private difficulty: "easy" | "normal" | "hard" = "normal";
  private random = new Random();
  private feedback = new GameFeedback();
  private previous = { rotate: false, hold: false };
  private horizontal = 0;
  private repeat = 0;
  init(_canvas: HTMLCanvasElement, config: GameConfig): void {
    this.random = new Random(config.seed);
    this.mode = config.mode === "sprint" ? "sprint" : "marathon";
    this.difficulty = config.difficulty ?? "normal";
    this.refill();
    this.spawn();
  }
  private matrix(rotation = this.rotation) {
    let matrix = shapes[this.piece];
    for (let r = 0; r < rotation; r++)
      matrix = matrix[0].map((_, x) => matrix.map((row) => row[x]).reverse());
    return matrix;
  }
  private fits(x: number, y: number, rotation = this.rotation): boolean {
    return this.matrix(rotation).every((row, dy) =>
      row.every(
        (cell, dx) =>
          !cell ||
          (x + dx >= 0 &&
            x + dx < 10 &&
            y + dy < 20 &&
            (y + dy < 0 || this.board[y + dy][x + dx] === 0)),
      ),
    );
  }
  private refill(): void {
    if (this.queue.length >= 7) return;
    const bag = [0, 1, 2, 3, 4, 5, 6];
    for (let i = 6; i > 0; i--) {
      const j = Math.floor(this.random.next() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    this.queue.push(...bag);
  }
  private spawn(piece?: number): void {
    this.piece = piece ?? this.queue.shift()!;
    this.refill();
    this.rotation = 0;
    this.x = 3;
    this.y = -1;
    this.fall = 0;
    this.lock = 0;
    this.resets = 0;
    if (!this.fits(this.x, this.y)) this.terminal = true;
  }
  private lockPiece(): void {
    let overflow = false;
    this.matrix().forEach((row, dy) =>
      row.forEach((cell, dx) => {
        if (!cell) return;
        if (this.y + dy < 0) overflow = true;
        else this.board[this.y + dy][this.x + dx] = this.piece + 1;
      }),
    );
    if (overflow) {
      this.terminal = true;
      return;
    }
    const kept = this.board.filter((row) => row.some((cell) => !cell));
    const cleared = 20 - kept.length;
    if (cleared) {
      const bonus =
        [0, 100, 300, 500, 800][cleared] * (1 + Math.floor(this.lines / 10));
      this.score += bonus;
      this.lines += cleared;
      this.board = [
        ...Array.from({ length: cleared }, () => Array<number>(10).fill(0)),
        ...kept,
      ];
      this.feedback.burst(
        750,
        365,
        "#bda4ff",
        cleared === 4 ? `FOUR LINES +${bonus}` : `+${bonus}`,
      );
      this.feedback.sound("collect");
    } else this.feedback.sound("hit");
    this.canHold = true;
    if (this.mode === "sprint" && this.lines >= 40) {
      this.terminal = true;
      return;
    }
    this.spawn();
  }
  update(dt: number, input: InputState): boolean {
    if (this.terminal) return false;
    this.elapsed += dt;
    this.feedback.update(dt);
    const rotate = input.up,
      drop = input.action,
      hold = !!(input.keys.KeyC || input.keys.KeyV);
    if (hold && !this.previous.hold && this.canHold) {
      const old = this.held;
      this.held = this.piece;
      this.spawn(old ?? undefined);
      this.canHold = false;
    }
    if (this.terminal) return false;
    const direction = Number(input.right) - Number(input.left);
    const resetLock = () => {
      if (this.lock > 0 && this.resets < 12) {
        this.lock = 0;
        this.resets++;
      }
    };
    if (direction) {
      this.repeat -= dt;
      if (direction !== this.horizontal || this.repeat <= 0) {
        if (this.fits(this.x + direction, this.y)) {
          this.x += direction;
          resetLock();
        }
        this.repeat = direction !== this.horizontal ? 170 : 65;
      }
    }
    this.horizontal = direction;
    if (rotate && !this.previous.rotate) {
      const rotation = (this.rotation + 1) % 4;
      for (const [dx, dy] of [
        [0, 0],
        [-1, 0],
        [1, 0],
        [-2, 0],
        [2, 0],
        [0, -1],
        [0, -2],
      ]) {
        if (this.fits(this.x + dx, this.y + dy, rotation)) {
          this.x += dx;
          this.y += dy;
          this.rotation = rotation;
          resetLock();
          break;
        }
      }
    }
    this.previous = { rotate, hold };
    if (drop && !this.dropWasHeld) {
      while (this.fits(this.x, this.y + 1)) {
        this.y++;
        this.score += 2;
      }
      this.lockPiece();
      this.dropWasHeld = drop;
      return !this.terminal;
    }
    this.dropWasHeld = drop;
    const level = 1 + Math.floor(this.lines / 10);
    const rate =
      (this.difficulty === "easy"
        ? 1000
        : this.difficulty === "hard"
          ? 550
          : 800) * Math.pow(0.82, level - 1);
    this.fall += dt;
    const interval = input.down ? 35 : Math.max(80, rate);
    while (this.fall >= interval) {
      this.fall -= interval;
      if (this.fits(this.x, this.y + 1)) {
        this.y++;
        if (input.down) this.score++;
        this.lock = 0;
      } else break;
    }
    if (!this.fits(this.x, this.y + 1)) {
      this.lock += dt;
      if (this.lock >= 450) this.lockPiece();
    } else this.lock = 0;
    return !this.terminal;
  }
  private dropWasHeld = false;
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#0c1222";
    ctx.fillRect(0, 0, 960, 640);
    const cell = 28,
      ox = 340,
      oy = 40;
    ctx.fillStyle = "#070c16";
    ctx.fillRect(ox - 3, oy - 3, 286, 566);
    const tile = (x: number, y: number, color: string, ghost = false) => {
      if (y < 0) return;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      if (ghost) {
        ctx.globalAlpha = 0.45;
        ctx.strokeRect(ox + x * cell + 3, oy + y * cell + 3, 22, 22);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillRect(ox + x * cell + 1, oy + y * cell + 1, 26, 26);
        if (color !== "#172035") {
          ctx.fillStyle = "#ffffff30";
          ctx.fillRect(ox + x * cell + 3, oy + y * cell + 3, 22, 3);
        }
      }
    };
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 10; x++)
        tile(x, y, this.board[y][x] ? colors[this.board[y][x] - 1] : "#172035");
    let landing = this.y;
    while (this.fits(this.x, landing + 1)) landing++;
    this.matrix().forEach((row, y) =>
      row.forEach((v, x) => {
        if (v) {
          tile(this.x + x, landing + y, colors[this.piece], true);
          tile(this.x + x, this.y + y, colors[this.piece]);
        }
      }),
    );
    const text = (
      label: string,
      x: number,
      y: number,
      size = 20,
      color = "#9eaecb",
    ) => {
      ctx.fillStyle = color;
      ctx.font = `${size}px Rajdhani, system-ui`;
      ctx.textAlign = "left";
      ctx.fillText(label, x, y);
    };
    const preview = (piece: number, x: number, y: number) =>
      shapes[piece].forEach((row, dy) =>
        row.forEach((v, dx) => {
          if (v) {
            ctx.fillStyle = colors[piece];
            ctx.fillRect(x + dx * 23, y + dy * 23, 21, 21);
          }
        }),
      );
    text("NEON TETRIS", 45, 70, 30, "#bda4ff");
    text(this.mode === "sprint" ? "40-LINE SPRINT" : "MARATHON", 45, 103);
    text("SCORE", 45, 180);
    text(String(this.score), 45, 225, 40, "#edf4ff");
    text(
      `LINES  ${this.lines}${this.mode === "sprint" ? " / 40" : ""}`,
      45,
      290,
    );
    text(`LEVEL  ${1 + Math.floor(this.lines / 10)}`, 45, 325);
    text(`${(this.elapsed / 1000).toFixed(1)}s`, 45, 377, 24);
    text("HOLD · C / X", 45, 465);
    if (this.held !== null) preview(this.held, 55, 490);
    text("NEXT", 680, 80);
    this.queue.slice(0, 3).forEach((p, i) => preview(p, 685, 110 + i * 85));
    text("↑ Rotate", 680, 430);
    text("← → Move", 680, 463);
    text("↓ Soft drop", 680, 496);
    text("Space / A Drop", 680, 529);
    text("Keep room for the next piece.", 45, 612, 18);
    this.feedback.render(ctx);
  }
  getScore() {
    return this.score;
  }
  getMetrics() {
    return {
      completed: this.mode === "sprint" && this.lines >= 40,
      elapsed_ms: Math.min(604800000, Math.max(1, Math.round(this.elapsed))),
    };
  }
  getResult() {
    return {
      title:
        this.lines >= 40 && this.mode === "sprint"
          ? "Sprint complete"
          : "Stack topped out",
      detail: `${this.lines} lines · ${(this.elapsed / 1000).toFixed(1)} seconds · ${this.score} points`,
    };
  }
  getState(): Record<string, unknown> {
    return {
      version: 1,
      board: this.board.map((row) => [...row]),
      piece: this.piece,
      rotation: this.rotation,
      x: this.x,
      y: this.y,
      queue: [...this.queue],
      held: this.held,
      canHold: this.canHold,
      score: this.score,
      lines: this.lines,
      elapsed: this.elapsed,
      fall: this.fall,
      lock: this.lock,
      resets: this.resets,
      terminal: this.terminal,
      mode: this.mode,
      difficulty: this.difficulty,
      random: this.random.state,
    };
  }
  setState(state: Record<string, unknown>): void {
    const data = schema.parse(state);
    if (!data.terminal && data.board.some((row) => row.every(Boolean))) {
      throw new Error("The saved stack contains an uncleared row");
    }
    // Validate active-piece geometry on an isolated candidate before accepting the save.
    const candidate = new TetrisGame();
    Object.assign(candidate, data);
    if (!data.terminal && !candidate.fits(data.x, data.y))
      throw new Error("The saved piece overlaps the stack");
    const { random, ...rest } = data;
    Object.assign(this, rest);
    this.random = new Random(random);
    this.previous = { rotate: false, hold: false };
    this.dropWasHeld = false;
    this.horizontal = 0;
    this.repeat = 0;
    this.feedback.clear();
  }
}
