import { PUZZLES } from "./puzzles";
import type { Merge2048View } from "./Merge2048Simulation";
import type { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../stores/settingsStore";
export class Merge2048Renderer {
  private feedback: GameFeedback;
  constructor(feedback: GameFeedback) {
    this.feedback = feedback;
  }

  render(ctx: CanvasRenderingContext2D, view: Merge2048View): void {
    const gradient = ctx.createLinearGradient(0, 0, view.width, view.height);
    gradient.addColorStop(0, "#111c2c");
    gradient.addColorStop(1, "#171329");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.width, view.height);
    const size = Math.min(view.width - 360, view.height - 180),
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
    view.board.forEach((_value, i) => {
      const p = position(i);
      drawTile(0, p.x, p.y);
    });
    const progress = 1 - view.animation / 150;
    if (view.animation > 45 && !useSettingsStore.getState().reducedMotion) {
      const eased = 1 - (1 - Math.min(1, progress / 0.7)) ** 3;
      for (const motion of view.motions) {
        const from = position(motion.from),
          to = position(motion.to);
        drawTile(
          motion.value,
          from.x + (to.x - from.x) * eased,
          from.y + (to.y - from.y) * eased,
        );
      }
    } else
      view.board.forEach((value, i) => {
        if (!value) return;
        const p = position(i);
        const animated =
          view.animation > 0 && !useSettingsStore.getState().reducedMotion;
        const scale =
          animated && i === view.spawned
            ? 0.65 + progress * 0.35
            : animated && view.merged.includes(i)
              ? 1 + Math.sin(progress * Math.PI) * 0.06
              : 1;
        drawTile(value, p.x, p.y, scale);
      });
    const best = Math.max(...view.board),
      target = view.won ? best * 2 : view.goal;
    ctx.textAlign = "left";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 16px Rajdhani, system-ui";
    ctx.fillText("SCORE", 660, 180);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 54px Rajdhani, system-ui";
    ctx.fillText(String(view.score), 660, 236);
    ctx.fillStyle = "#67e8f9";
    ctx.font = "700 28px Rajdhani, system-ui";
    ctx.fillText(
      view.won
        ? view.puzzleMode
          ? "PUZZLE SOLVED"
          : "2048 REACHED"
        : `BUILD TO ${view.goal}`,
      660,
      338,
    );
    ctx.fillStyle = "#a8b6ca";
    ctx.font = "18px Rajdhani, system-ui";
    ctx.fillText(
      view.puzzleMode
        ? `${view.moves} / ${PUZZLES[view.puzzle].moves} moves · No spawns`
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
      view.undo ? "Z / B   Undo last move" : "Z / B   Undo unavailable",
      660,
      488,
    );
    ctx.fillText("ESC   Pause", 660, 516);
    this.feedback.render(ctx);
  }
  destroy() {}
}
