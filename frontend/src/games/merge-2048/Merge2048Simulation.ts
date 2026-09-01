import { checkedScore } from "../../contracts/gameplay";
import { parseState } from "./codec";
import { limits } from "../../contracts/gameplay";
import { PUZZLES } from "./puzzles";
import { Random } from "../../sdk/Random";
import type { InputState, GameConfig } from "../../sdk/GameSDK";
interface TileMotion {
  value: number;
  from: number;
  to: number;
}
interface UndoState {
  board: number[];
  score: number;
  randomState?: number;
}

export function moveBoard(
  board: number[],
  direction: "left" | "right" | "up" | "down",
) {
  const next = [...board],
    motions: TileMotion[] = [],
    merged: number[] = [];
  let score = 0;
  for (let row = 0; row < 4; row++) {
    const indices = Array.from({ length: 4 }, (_, col) =>
      direction === "left"
        ? row * 4 + col
        : direction === "right"
          ? row * 4 + 3 - col
          : direction === "up"
            ? col * 4 + row
            : (3 - col) * 4 + row,
    );
    const values = indices.filter((i) => board[i]);
    indices.forEach((i) => {
      next[i] = 0;
    });
    let target = 0;
    for (let i = 0; i < values.length; i++, target++) {
      const from = values[i],
        to = indices[target];
      motions.push({ value: board[from], from, to });
      if (board[from] === board[values[i + 1]]) {
        motions.push({ value: board[from], from: values[++i], to });
        next[to] = board[from] * 2;
        score += next[to];
        merged.push(to);
      } else next[to] = board[from];
    }
  }
  return { board: next, score, motions, merged };
}
import { silentEffects, type SimulationEffects } from "../simulationEffects";
export class Merge2048Simulation {
  private board = Array<number>(16).fill(0);
  private score = 0;
  private random = new Random();
  private mode = "classic";
  private terminal = false;
  private held: string | null = null;
  private width = 960;
  private height = 640;
  private won = false;
  private undo: UndoState | null = null;
  private undoHeld = false;
  private animation = 0;
  private motions: TileMotion[] = [];
  private merged: number[] = [];
  private spawned: number | null = null;
  private feedback: SimulationEffects;
  constructor(feedback: SimulationEffects = silentEffects) {
    this.feedback = feedback;
  }
  private puzzle = 0;
  private moves = 0;
  private pendingDirection: "left" | "right" | "up" | "down" | null = null;
  private pendingUndo = false;
  private explanation =
    "Matching tiles merge once per move. Use the arrow keys or the slide buttons.";
  private get puzzleMode() {
    return this.mode === "daily";
  }
  private get goal() {
    return this.puzzleMode ? PUZZLES[this.puzzle].target : 2048;
  }
  private isFinished() {
    if (this.board.some((value) => value >= limits.highest_tile)) return true;
    return this.puzzleMode
      ? this.won || this.moves >= PUZZLES[this.puzzle].moves || !this.hasMoves()
      : !this.hasMoves();
  }
  configure(width: number, height: number, config?: GameConfig): void {
    this.random = new Random(config?.seed);
    this.mode = config?.mode ?? "classic";
    this.width = width;
    this.height = height;
    if (this.puzzleMode) {
      this.puzzle = (config?.seed ?? 0) % PUZZLES.length;
      this.board = [...PUZZLES[this.puzzle].board];
    } else {
      this.spawn();
      this.spawn();
    }
    this.publishBoard();
  }
  private spawn(): void {
    const empty = this.board
      .map((value, i) => (value === 0 ? i : -1))
      .filter((i) => i >= 0);
    if (empty.length) {
      this.spawned = empty[Math.floor(this.random.next() * empty.length)];
      this.board[this.spawned] = this.random.next() < 0.9 ? 2 : 4;
    }
  }
  update(dt: number, input: InputState): boolean {
    this.feedback.update(dt);
    this.animation = Math.max(0, this.animation - dt);
    const undoPressed = !!(input.keys.KeyZ || input.cancel || this.pendingUndo);
    this.pendingUndo = false;
    if (undoPressed && !this.undoHeld && this.undo) {
      this.recover();
    }
    this.undoHeld = undoPressed;
    this.terminal = this.isFinished();
    if (this.terminal) return false;
    const direction =
      this.pendingDirection ??
      (input.left
        ? "left"
        : input.right
          ? "right"
          : input.up
            ? "up"
            : input.down
              ? "down"
              : null);
    const fromReader = this.pendingDirection !== null;
    this.pendingDirection = null;
    if (!direction) {
      this.held = null;
      return true;
    }
    if (!fromReader && this.held === direction) return true;
    this.held = direction;
    const result = moveBoard(this.board, direction);
    if (this.board.some((value, i) => value !== result.board[i])) {
      const nextScore = checkedScore(this.score + result.score);
      this.undo =
        this.mode !== "classic"
          ? null
          : {
              board: [...this.board],
              score: this.score,
              randomState: this.random.state,
            };
      this.board = result.board;
      this.score = nextScore;
      this.motions = result.motions;
      this.merged = result.merged;
      this.animation = 150;
      this.moves++;
      if (!this.puzzleMode) this.spawn();
      this.explanation = `${direction}. ${result.merged.length ? result.merged.map((i) => `${result.board[i] / 2} + ${result.board[i] / 2} = ${result.board[i]}`).join("; ") : "Tiles moved without merging"}.${this.puzzleMode ? " No new tile spawns in puzzles." : ""}`;
      this.feedback.sound(result.score ? "collect" : "hit");
      if (result.score)
        this.feedback.burst(790, 265, "#67e8f9", `+${result.score}`);
    }
    if (!this.won && this.board.some((value) => value >= this.goal)) {
      this.won = true;
      this.feedback.burst(
        760,
        320,
        "#edc96c",
        this.puzzleMode ? "PUZZLE SOLVED" : "2048! KEEP GOING",
      );
      this.feedback.sound("collect");
    }
    this.terminal = this.isFinished();
    this.publishBoard();
    return !this.terminal;
  }
  private hasMoves(): boolean {
    return this.board.some(
      (value, i) =>
        value === 0 ||
        (i % 4 < 3 && value === this.board[i + 1]) ||
        (i < 12 && value === this.board[i + 4]),
    );
  }
  getScore(): number {
    return this.score;
  }
  getState(): Record<string, unknown> {
    return structuredClone({
      version: 1,
      randomState: this.random.state,
      mode: this.mode,
      board: this.board,
      score: this.score,
      undo: this.undo,
      puzzle: this.puzzle,
      moves: this.moves,
    });
  }
  setState(state: Record<string, unknown>): void {
    const data = parseState(state);
    this.random.state = data.randomState;
    this.mode = data.mode;
    this.puzzle = data.puzzle;
    this.moves = data.moves;
    this.terminal = false;
    this.board = data.board;
    this.score = data.score;
    this.undo = this.mode !== "classic" ? null : data.undo;
    this.undoHeld = false;
    this.animation = 0;
    this.feedback.clear();
    this.held = null;
    this.won = this.board.some((v) => v >= this.goal);
    this.publishBoard();
  }
  getStatus(): "playing" | "recoverable" | "complete" {
    return this.terminal ? (this.undo ? "recoverable" : "complete") : "playing";
  }
  recover(): void {
    if (!this.undo) return;
    this.board = [...this.undo.board];
    this.score = this.undo.score;
    // Older one-move saves predate RNG snapshots; undo the two LCG draws used to spawn a tile.
    const rewind = (state: number) =>
      Math.imul(state - 1013904223, 4276115653) >>> 0;
    this.random.state =
      this.undo.randomState ?? rewind(rewind(this.random.state));
    this.moves = Math.max(0, this.moves - 1);
    this.explanation =
      "Move undone. Repeating the move produces the same next tile.";
    this.undo = null;
    this.terminal = false;
    this.animation = 0;
    this.held = null;
    this.won = this.board.some((v) => v >= this.goal);
    this.publishBoard();
    this.feedback.clear();
    this.feedback.sound("hit");
  }
  getMetrics() {
    return { highest_tile: Math.max(...this.board), completed: this.won };
  }
  getResult(): { title: string; detail: string } {
    return {
      title:
        Math.max(...this.board) >= limits.highest_tile
          ? "Maximum tile reached"
          : this.puzzleMode
            ? this.won
              ? "Daily puzzle solved"
              : "Puzzle attempt complete"
            : this.won
              ? "2048 reached"
              : "No moves left",
      detail: `Highest tile ${Math.max(...this.board)} · ${this.score} points${this.puzzleMode ? ` · ${this.moves}/${PUZZLES[this.puzzle].moves} moves` : ""}`,
    };
  }
  destroy(): void {}
  private revision = 0;
  private publishBoard() {
    this.revision++;
  }
  requestDirection(value: "left" | "right" | "up" | "down") {
    this.pendingDirection = value;
  }
  requestUndo() {
    this.pendingUndo = true;
  }
  getRenderView() {
    return {
      animation: this.animation,
      board: this.board,
      explanation: this.explanation,
      goal: this.goal,
      height: this.height,
      merged: this.merged,
      motions: this.motions,
      moves: this.moves,
      puzzle: this.puzzle,
      puzzleMode: this.puzzleMode,
      revision: this.revision,
      score: this.score,
      spawned: this.spawned,
      undo: this.undo,
      width: this.width,
      won: this.won,
    };
  }
}
export type Merge2048View = import("../simulationEffects").RenderView<
  ReturnType<Merge2048Simulation["getRenderView"]>
>;
