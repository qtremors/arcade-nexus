import { PUZZLES } from "./puzzles";
import "./puzzle.css";
import { Random } from "../../sdk/Random";
import { z } from "zod";
import type { Game2DInstance, InputState, GameConfig } from "../../sdk/GameSDK";
import { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../stores/settingsStore";
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
export class Merge2048Game implements Game2DInstance {
  readonly type = "2d" as const;
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
  private feedback = new GameFeedback();
  private puzzle = 0;
  private moves = 0;
  private reader: HTMLDetailsElement | null = null;
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
    return this.puzzleMode
      ? this.won || this.moves >= PUZZLES[this.puzzle].moves || !this.hasMoves()
      : !this.hasMoves();
  }
  init(canvas: HTMLCanvasElement, config?: GameConfig): void {
    this.random = new Random(config?.seed);
    this.mode = config?.mode ?? "classic";
    this.width = canvas.width;
    this.height = canvas.height;
    if (this.puzzleMode) {
      this.puzzle = (config?.seed ?? 0) % PUZZLES.length;
      this.board = [...PUZZLES[this.puzzle].board];
    } else {
      this.spawn();
      this.spawn();
    }
    this.createReader(canvas);
    this.syncReader();
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
      this.undo =
        this.mode !== "classic"
          ? null
          : {
              board: [...this.board],
              score: this.score,
              randomState: this.random.state,
            };
      this.board = result.board;
      this.score += result.score;
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
    this.syncReader();
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
  render(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, "#111c2c");
    gradient.addColorStop(1, "#171329");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    const size = Math.min(this.width - 360, this.height - 180),
      cell = size / 4;
    const x = 75,
      y = 130;
    ctx.textAlign = "left";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 15px JetBrains Mono, monospace";
    ctx.fillText("ARCADE NEXUS / PUZZLE", x, 48);
    ctx.font = "700 48px Rajdhani, system-ui";
    ctx.fillStyle = "#f8fafc";
    ctx.fillText("MERGE 2048", x, 103);
    ctx.fillStyle = "#090f1ccc";
    ctx.beginPath();
    ctx.roundRect(x - 12, y - 12, size + 24, size + 24, 20);
    ctx.fill();
    const position = (index: number) => ({
      x: x + (index % 4) * cell,
      y: y + Math.floor(index / 4) * cell,
    });
    const drawTile = (value: number, px: number, py: number, scale = 1) => {
      const inset = 5 + ((cell - 10) * (1 - scale)) / 2,
        tileSize = (cell - 10) * scale;
      const palettes = [
        "#c8e7ea",
        "#8dd7df",
        "#39bdcb",
        "#159cb7",
        "#3679c5",
        "#545bc4",
        "#7754b8",
        "#a050aa",
        "#c9599d",
        "#e89967",
        "#edc96c",
      ];
      ctx.fillStyle = value
        ? palettes[Math.min(palettes.length - 1, Math.log2(value) - 1)]
        : "#202d40";
      ctx.beginPath();
      ctx.roundRect(px + inset, py + inset, tileSize, tileSize, 12);
      ctx.fill();
      if (!value) return;
      ctx.fillStyle = "#ffffff30";
      ctx.fillRect(
        px + inset + 10,
        py + inset + 3,
        Math.max(0, tileSize - 20),
        2,
      );
      ctx.fillStyle = value <= 4 ? "#123143" : "#fff";
      ctx.textAlign = "center";
      ctx.font = `700 ${value >= 1024 ? 30 : 42}px Rajdhani, system-ui`;
      ctx.fillText(String(value), px + cell / 2, py + cell / 2 + 14);
    };
    this.board.forEach((_value, i) => {
      const p = position(i);
      drawTile(0, p.x, p.y);
    });
    const progress = 1 - this.animation / 150;
    if (this.animation > 45 && !useSettingsStore.getState().reducedMotion) {
      const eased = 1 - (1 - Math.min(1, progress / 0.7)) ** 3;
      for (const motion of this.motions) {
        const from = position(motion.from),
          to = position(motion.to);
        drawTile(
          motion.value,
          from.x + (to.x - from.x) * eased,
          from.y + (to.y - from.y) * eased,
        );
      }
    } else
      this.board.forEach((value, i) => {
        if (!value) return;
        const p = position(i);
        const animated =
          this.animation > 0 && !useSettingsStore.getState().reducedMotion;
        const scale =
          animated && i === this.spawned
            ? 0.65 + progress * 0.35
            : animated && this.merged.includes(i)
              ? 1 + Math.sin(progress * Math.PI) * 0.06
              : 1;
        drawTile(value, p.x, p.y, scale);
      });
    const best = Math.max(...this.board),
      target = this.won ? best * 2 : this.goal;
    ctx.textAlign = "left";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 16px Rajdhani, system-ui";
    ctx.fillText("SCORE", 660, 180);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 54px Rajdhani, system-ui";
    ctx.fillText(String(this.score), 660, 236);
    ctx.fillStyle = "#67e8f9";
    ctx.font = "700 28px Rajdhani, system-ui";
    ctx.fillText(
      this.won
        ? this.puzzleMode
          ? "PUZZLE SOLVED"
          : "2048 REACHED"
        : `BUILD TO ${this.goal}`,
      660,
      338,
    );
    ctx.fillStyle = "#a8b6ca";
    ctx.font = "18px Rajdhani, system-ui";
    ctx.fillText(
      this.puzzleMode
        ? `${this.moves} / ${PUZZLES[this.puzzle].moves} moves · No spawns`
        : `Highest tile  ${best}`,
      660,
      370,
    );
    ctx.fillStyle = "#293449";
    ctx.fillRect(660, 395, 220, 5);
    ctx.fillStyle = "#67e8f9";
    ctx.fillRect(
      660,
      395,
      220 * Math.min(1, Math.log2(Math.max(2, best)) / Math.log2(target)),
      5,
    );
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px Rajdhani, system-ui";
    ctx.fillText("ARROWS / WASD   Slide", 660, 460);
    ctx.fillText(
      this.undo ? "Z / B   Undo last move" : "Z / B   Undo unavailable",
      660,
      488,
    );
    ctx.fillText("ESC   Pause", 660, 516);
    this.feedback.render(ctx);
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
    const data = z
      .object({
        version: z.literal(1),
        randomState: z.number().int().min(0).max(4294967295).default(42),
        mode: z.enum(["classic", "challenge", "daily"]).default("classic"),
        puzzle: z
          .number()
          .int()
          .min(0)
          .max(PUZZLES.length - 1)
          .default(0),
        moves: z.number().int().nonnegative().max(1000000).default(0),
        board: z
          .array(
            z
              .number()
              .int()
              .min(0)
              .max(1048576)
              .refine((n) => n === 0 || (n >= 2 && (n & (n - 1)) === 0)),
          )
          .length(16),
        score: z.number().int().min(0).max(2147483647),
        undo: z
          .object({
            randomState: z.number().int().min(0).max(4294967295).optional(),
            board: z
              .array(
                z
                  .number()
                  .int()
                  .min(0)
                  .max(1048576)
                  .refine((n) => n === 0 || (n >= 2 && (n & (n - 1)) === 0)),
              )
              .length(16),
            score: z.number().int().min(0).max(2147483647),
          })
          .nullable()
          .default(null),
      })
      .parse(state);
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
    this.syncReader();
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
    this.syncReader();
    this.feedback.clear();
    this.feedback.sound("hit");
  }
  getMetrics() {
    return { highest_tile: Math.max(...this.board), completed: this.won };
  }
  getResult(): { title: string; detail: string } {
    return {
      title: this.puzzleMode
        ? this.won
          ? "Daily puzzle solved"
          : "Puzzle attempt complete"
        : this.won
          ? "2048 reached"
          : "No moves left",
      detail: `Highest tile ${Math.max(...this.board)} · ${this.score} points${this.puzzleMode ? ` · ${this.moves}/${PUZZLES[this.puzzle].moves} moves` : ""}`,
    };
  }
  private createReader(canvas: HTMLCanvasElement): void {
    this.reader = document.createElement("details");
    this.reader.className = "puzzle-reader";
    // Preserve native Space/Enter activation for the semantic controls.
    this.reader.addEventListener("keydown", (event) => {
      if (
        (event.code === "Space" || event.code === "Enter") &&
        event.target instanceof HTMLElement &&
        event.target.closest("button, summary")
      )
        event.stopPropagation();
    });
    this.reader.innerHTML = `<summary>Board reader & move explanations</summary><p class="puzzle-objective"></p><table aria-label="2048 board"><caption>Rows from top to bottom; empty cells say empty</caption><tbody></tbody></table><div class="puzzle-buttons"></div><p class="puzzle-explanation" role="status" aria-live="polite" aria-atomic="true"></p>`;
    for (const direction of ["left", "up", "down", "right"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `Slide ${direction}`;
      button.onclick = () => {
        this.pendingDirection = direction;
      };
      this.reader.querySelector(".puzzle-buttons")!.appendChild(button);
    }
    const undo = document.createElement("button");
    undo.type = "button";
    undo.textContent = "Undo move";
    undo.dataset.undo = "true";
    undo.onclick = () => {
      this.pendingUndo = true;
    };
    this.reader.querySelector(".puzzle-buttons")!.appendChild(undo);
    canvas.parentElement?.appendChild(this.reader);
  }
  private syncReader(): void {
    if (!this.reader) return;
    const body = this.reader.querySelector("tbody")!;
    body.replaceChildren();
    for (let row = 0; row < 4; row++) {
      const tr = document.createElement("tr");
      for (let col = 0; col < 4; col++) {
        const td = document.createElement("td");
        const value = this.board[row * 4 + col] || "empty";
        td.textContent = String(value);
        td.setAttribute(
          "aria-label",
          `Row ${row + 1}, column ${col + 1}: ${value}`,
        );
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    this.reader.querySelector(".puzzle-objective")!.textContent = this
      .puzzleMode
      ? `${PUZZLES[this.puzzle].name}. Make ${this.goal} in ${PUZZLES[this.puzzle].moves} moves. ${this.moves} moves used. No new tiles spawn.`
      : "Merge equal tiles to reach 2048. One undo is available in relaxed mode.";
    this.reader.querySelector(".puzzle-explanation")!.textContent =
      this.explanation;
    (this.reader.querySelector("[data-undo]") as HTMLButtonElement).disabled =
      !this.undo;
  }
  destroy(): void {
    this.reader?.remove();
    this.reader = null;
  }
}
