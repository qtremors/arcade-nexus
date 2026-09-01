import { checkedScore } from "../../contracts/gameplay";
import { parseState } from "./codec";
import { rotations } from "./geometry";
import type { GameConfig, InputState } from "../../sdk/GameSDK";
import { Random } from "../../sdk/Random";

import { silentEffects, type SimulationEffects } from "../simulationEffects";
export class TetrisSimulation {
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
  private feedback: SimulationEffects;
  constructor(feedback: SimulationEffects = silentEffects) {
    this.feedback = feedback;
  }
  private previous = { rotate: false, hold: false };
  private horizontal = 0;
  private repeat = 0;
  configure(
    width: number,
    height: number,
    config: Partial<GameConfig> = {},
  ): void {
    void width;
    void height;
    this.random = new Random(config.seed);
    this.mode = config.mode === "sprint" ? "sprint" : "marathon";
    this.difficulty = config.difficulty ?? "normal";
    this.refill();
    this.spawn();
  }
  private matrix(rotation = this.rotation) {
    return rotations[this.piece][rotation];
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
      this.score = checkedScore(this.score + bonus);
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
        this.score = checkedScore(this.score + 2);
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
        if (input.down) this.score = checkedScore(this.score + 1);
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
    const data = parseState(state);
    const { random, ...rest } = data;
    Object.assign(this, rest);
    this.random = new Random(random);
    this.previous = { rotate: false, hold: false };
    this.dropWasHeld = false;
    this.horizontal = 0;
    this.repeat = 0;
    this.feedback.clear();
  }
  destroy() {}
  getRenderView() {
    return {
      board: this.board,
      elapsed: this.elapsed,
      fits: this.fits.bind(this),
      held: this.held,
      lines: this.lines,
      matrix: this.matrix.bind(this),
      mode: this.mode,
      piece: this.piece,
      queue: this.queue,
      score: this.score,
      x: this.x,
      y: this.y,
    };
  }
}
export type TetrisView = import("../simulationEffects").RenderView<
  ReturnType<TetrisSimulation["getRenderView"]>
>;
