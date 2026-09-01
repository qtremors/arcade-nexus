import { shapes } from "./geometry";
const colors = [
  "#73e6ed",
  "#f8d477",
  "#bda4ff",
  "#7de8ad",
  "#ff8aa8",
  "#87aaff",
  "#ffbe83",
];
import type { TetrisView } from "./TetrisSimulation";
import type { GameFeedback } from "../feedback";
export class TetrisRenderer {
  private feedback: GameFeedback;
  constructor(feedback: GameFeedback) {
    this.feedback = feedback;
  }

  render(ctx: CanvasRenderingContext2D, view: TetrisView): void {
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
        tile(x, y, view.board[y][x] ? colors[view.board[y][x] - 1] : "#172035");
    let landing = view.y;
    while (view.fits(view.x, landing + 1)) landing++;
    view.matrix().forEach((row, y) =>
      row.forEach((v, x) => {
        if (v) {
          tile(view.x + x, landing + y, colors[view.piece], true);
          tile(view.x + x, view.y + y, colors[view.piece]);
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
    text(view.mode === "sprint" ? "40-LINE SPRINT" : "MARATHON", 45, 103);
    text("SCORE", 45, 180);
    text(String(view.score), 45, 225, 40, "#edf4ff");
    text(
      `LINES  ${view.lines}${view.mode === "sprint" ? " / 40" : ""}`,
      45,
      290,
    );
    text(`LEVEL  ${1 + Math.floor(view.lines / 10)}`, 45, 325);
    text(`${(view.elapsed / 1000).toFixed(1)}s`, 45, 377, 24);
    text("HOLD · C / X", 45, 465);
    if (view.held !== null) preview(view.held, 55, 490);
    text("NEXT", 680, 80);
    view.queue.slice(0, 3).forEach((p, i) => preview(p, 685, 110 + i * 85));
    text("↑ Rotate", 680, 430);
    text("← → Move", 680, 463);
    text("↓ Soft drop", 680, 496);
    text("Space / A Drop", 680, 529);
    text("Keep room for the next piece.", 45, 612, 18);
    this.feedback.render(ctx);
  }
  destroy() {}
}
