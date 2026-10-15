import { ARCADE_SECTORS } from "./sectors";
import type { BreakoutView } from "./BreakoutSimulation";
import type { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../stores/settingsStore";
import { CanvasLayer } from "../../sdk/CanvasLayer";
export class BreakoutRenderer {
  private feedback: GameFeedback;
  constructor(feedback: GameFeedback) {
    this.feedback = feedback;
  }
  private background = new CanvasLayer();
  render(ctx: CanvasRenderingContext2D, view: BreakoutView): void {
    const key = `${view.stage}:${view.bricks.map((active, i) => (active ? view.armor[i] : 0)).join("")}`;
    this.background.draw(ctx, view.width, view.height, key, (layer) =>
      this.paintPlayfield(layer, view),
    );
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 16px Rajdhani, system-ui";
    ctx.textAlign = "left";
    ctx.fillText("NEON BREAKOUT", 40, 36);
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "700 28px Rajdhani, system-ui";
    ctx.fillText(String(view.score).padStart(4, "0"), 40, 65);
    ctx.textAlign = "center";
    ctx.font = "600 18px Rajdhani, system-ui";
    ctx.fillStyle = "#c4b5fd";
    ctx.fillText(
      `SECTOR 0${view.stage} / 0${view.stageCount}`,
      view.width / 2,
      40,
    );
    ctx.font = "14px JetBrains Mono, monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      view.mode === "arcade"
        ? ARCADE_SECTORS[view.stage - 1].name
        : `${view.bricks.filter(Boolean).length} BLOCKS REMAIN`,
      view.width / 2,
      64,
    );
    ctx.textAlign = "right";
    ctx.fillStyle = "#67e8f9";
    ctx.font = "24px system-ui";
    ctx.fillText(
      "● ".repeat(view.lives) + "○ ".repeat(3 - view.lives),
      view.width - 40,
      52,
    );
    if (!useSettingsStore.getState().reducedMotion)
      view.trail.forEach((point, i) => {
        ctx.globalAlpha = (i / view.trail.length) * 0.4;
        ctx.fillStyle = "#67e8f9";
        ctx.beginPath();
        ctx.arc(
          point.x,
          point.y,
          3 + (i / view.trail.length) * 4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      });
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#67e8f9";
    ctx.fillRect(
      view.paddle - view.paddleWidth / 2,
      view.height - 60,
      view.paddleWidth,
      14,
    );
    ctx.fillStyle = "#ecfeff";
    ctx.fillRect(
      view.paddle - view.paddleWidth / 2 + 4,
      view.height - 58,
      view.paddleWidth - 8,
      3,
    );
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(view.ball.x, view.ball.y, 8, 0, Math.PI * 2);
    ctx.fill();
    for (const ball of view.extraBalls) {
      ctx.fillStyle = "#ffe9a3";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of view.pickups) {
      ctx.fillStyle = "#ffd779";
      ctx.fillRect(p.x - 13, p.y - 12, 26, 24);
      ctx.fillStyle = "#172035";
      ctx.font = "bold 17px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(p.kind === "wide" ? "W" : "M", p.x, p.y + 6);
    }
    ctx.font = "16px Rajdhani, system-ui";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffd779";
    if (view.mode === "arcade")
      ctx.fillText(
        `WIDE ${Math.ceil(view.wideTime)}s · MULTIBALL ${Math.ceil(view.multiTime)}s`,
        40,
        300,
      );
    if (view.bricks.filter(Boolean).length <= 3 && view.sinceHit > 8000) {
      ctx.fillStyle = "#d0f8ff";
      ctx.textAlign = "center";
      ctx.fillText(
        "CLEANUP ASSIST · Next paddle hit aims at the remaining bricks",
        view.width / 2,
        335,
      );
    }
    this.feedback.render(ctx);
    if (!view.launched) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "600 18px Rajdhani, system-ui";
      ctx.fillText(
        "Move the paddle • Space / A to launch",
        view.width / 2,
        view.height - 22,
      );
    }
  }
  private paintPlayfield(
    ctx: CanvasRenderingContext2D,
    view: BreakoutView,
  ): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, view.height);
    gradient.addColorStop(0, "#17142e");
    gradient.addColorStop(1, "#080d18");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.strokeStyle = "#243049";
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.moveTo(view.width / 2 + (i - 8) * 28, 280);
      ctx.lineTo((i - 4) * 120, view.height);
      ctx.stroke();
    }
    for (let y = 310; y < view.height; y += 45) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(view.width - 20, y);
      ctx.stroke();
    }
    const width = (view.width - 80) / 10;
    view.bricks.forEach((active, i) => {
      if (!active) return;
      ctx.fillStyle = `hsl(${180 + Math.floor(i / 10) * 22} 80% 60%)`;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6 * ctx.getTransform().a;
      ctx.fillRect(
        40 + (i % 10) * width,
        95 + Math.floor(i / 10) * 28,
        width - 4,
        22,
      );
      ctx.shadowBlur = 0;
      if (view.armor[i] > 1) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          42 + (i % 10) * width,
          97 + Math.floor(i / 10) * 28,
          width - 8,
          18,
        );
      }
      if (view.stage === 3 && i % 7 === 0) {
        ctx.fillStyle = "#fff";
        ctx.font = "14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(
          "✦",
          40 + ((i % 10) + 0.5) * width,
          112 + Math.floor(i / 10) * 28,
        );
      }
      ctx.fillStyle = "#ffffff50";
      ctx.fillRect(
        40 + (i % 10) * width + 2,
        97 + Math.floor(i / 10) * 28,
        width - 8,
        3,
      );
    });
  }
  destroy() {
    this.background.destroy();
  }
}
