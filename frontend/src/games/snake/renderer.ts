import { MAZE_NAMES } from "./mazes";
import type { SnakeView } from "./SnakeSimulation";
import type { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../shared/state/settingsStore";
import { CanvasLayer } from "../../sdk/CanvasLayer";
export class SnakeRenderer {
  private feedback: GameFeedback;
  constructor(feedback: GameFeedback) {
    this.feedback = feedback;
  }
  private background = new CanvasLayer();
  private ctx!: CanvasRenderingContext2D;
  render(ctx: CanvasRenderingContext2D, view: SnakeView): void {
    this.ctx = ctx;
    const { width, height } = view;

    this.background.draw(ctx, width, height, view.walls, (layer) => {
      const gradient = layer.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, view.colors.bg1);
      gradient.addColorStop(1, view.colors.bg2);
      layer.fillStyle = gradient;
      layer.fillRect(0, 0, width, height);
      this.renderGrid(layer, view);
      layer.fillStyle = "#a78bfa";
      for (const wall of view.walls)
        layer.fillRect(
          view.gridOffsetX + wall.x * view.cellSize + 2,
          view.gridOffsetY + wall.y * view.cellSize + 2,
          view.cellSize - 4,
          view.cellSize - 4,
        );
    });
    if (view.mode.startsWith("sprint")) {
      ctx.font = "18px system-ui";
      ctx.fillStyle = "#fff";
      ctx.fillText(
        `${Math.max(0, 60 - Math.floor(view.elapsed / 1000))}s left`,
        110,
        40,
      );
    }

    if (view.mode === "maze") {
      ctx.textAlign = "left";
      ctx.font = "16px Rajdhani, system-ui";
      ctx.fillStyle = "#c4b5fd";
      ctx.fillText(MAZE_NAMES[view.mazeIndex], view.gridOffsetX, height - 18);
    }
    if (view.bonus) {
      const x = view.gridOffsetX + (view.bonus.x + 0.5) * view.cellSize,
        y = view.gridOffsetY + (view.bonus.y + 0.5) * view.cellSize;
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
        `BONUS +30 · ${Math.ceil((view.bonus.expires - view.elapsed) / 1000)}s`,
        view.gridOffsetX,
        height - 18,
      );
    }
    // Food with glow
    this.renderFood(view);

    // Snake with glow
    this.renderSnake(view);

    // Particles
    this.renderParticles(view);

    // Score
    this.renderScore(view);
    this.feedback.render(ctx);
  }
  private renderGrid(ctx: CanvasRenderingContext2D, view: SnakeView): void {
    ctx.strokeStyle = view.colors.grid;
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= view.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(view.gridOffsetX + x * view.cellSize, view.gridOffsetY);
      ctx.lineTo(
        view.gridOffsetX + x * view.cellSize,
        view.gridOffsetY + view.rows * view.cellSize,
      );
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= view.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(view.gridOffsetX, view.gridOffsetY + y * view.cellSize);
      ctx.lineTo(
        view.gridOffsetX + view.cols * view.cellSize,
        view.gridOffsetY + y * view.cellSize,
      );
      ctx.stroke();
    }

    // Border around play area
    ctx.strokeStyle = "rgba(88, 166, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      view.gridOffsetX,
      view.gridOffsetY,
      view.cols * view.cellSize,
      view.rows * view.cellSize,
    );
  }
  private renderFood(view: SnakeView): void {
    const { ctx } = this;
    const x =
      view.gridOffsetX + view.food.x * view.cellSize + view.cellSize / 2;
    const y =
      view.gridOffsetY + view.food.y * view.cellSize + view.cellSize / 2;
    const pulse = useSettingsStore.getState().reducedMotion
      ? 1
      : 1 + Math.sin(view.foodPulse) * 0.15;
    const size = (view.cellSize / 2 - 4) * pulse;

    // Glow
    ctx.shadowColor = view.colors.foodGlow;
    ctx.shadowBlur = 20 * ctx.getTransform().a;

    // Food
    ctx.fillStyle = view.colors.food;
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
  private renderSnake(view: SnakeView): void {
    const { ctx } = this;

    // Linear Interpolation factor (0 to 1)
    const alpha = useSettingsStore.getState().reducedMotion
      ? 1
      : Math.min(1, view.moveTimer / view.moveInterval);

    // Draw segments
    for (let i = 0; i < view.snake.length; i++) {
      const current = view.snake[i];
      let next = view.snake[i + 1];

      // If it's the last segment, interpolate towards lastTail
      if (!next) {
        if (view.lastTail) next = view.lastTail;
        else next = current; // Should't happen ideally
      }

      // Lerp between next (previous position) and current (new position)
      // Visual Head moves from snake[1] to snake[0]
      // Visual Segment i moves from snake[i+1] to snake[i]

      const lx = next.x + (current.x - next.x) * alpha;
      const ly = next.y + (current.y - next.y) * alpha;

      const x = view.gridOffsetX + lx * view.cellSize;
      const y = view.gridOffsetY + ly * view.cellSize;
      const isHead = i === 0;

      // Progress for gradient (0 = tail, 1 = head)
      const progress = (view.snake.length - i) / view.snake.length;

      // Size varies slightly
      const padding = isHead ? 2 : 3;
      const size = view.cellSize - padding * 2;
      const radius = isHead ? size / 2 : size / 3;

      // Glow for head
      if (isHead) {
        ctx.shadowColor = view.colors.snakeGlow;
        ctx.shadowBlur = 15 * ctx.getTransform().a;
      }

      // Color gradient from head to tail
      const opacity = 0.4 + progress * 0.6;
      ctx.fillStyle = isHead
        ? view.colors.snakeHead
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
        const hx = x + view.cellSize / 2;
        const hy = y + view.cellSize / 2;

        ctx.fillStyle = "#fff";
        const eyeOffset = 4;
        const eyeSize = 3;

        // Determine eye direction based on movement
        // Use current direction for simplicity, or interpolate angle
        let ex1 = 0,
          ey1 = 0,
          ex2 = 0,
          ey2 = 0;
        switch (view.direction) {
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
  private renderParticles(view: SnakeView): void {
    if (useSettingsStore.getState().reducedMotion) return;
    const { ctx } = this;
    for (const p of view.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  private renderScore(view: SnakeView): void {
    const { ctx } = this;
    const { width } = view;

    // Score top center
    ctx.fillStyle = view.colors.text;
    ctx.font =
      'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(`${view.score}`, width / 2, 45);
    ctx.textAlign = "left";
    ctx.font = "600 16px Rajdhani, system-ui";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("NEON SNAKE", view.gridOffsetX, 48);
    ctx.textAlign = "right";
    ctx.fillText(
      `PACE ${Math.round((1000 / view.moveInterval) * 10) / 10} / s`,
      width - view.gridOffsetX,
      48,
    );
    ctx.textAlign = "center";

    // Length indicator
    ctx.fillStyle = view.colors.textDim;
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`LENGTH: ${view.snake.length}`, width / 2, 68);
  }
  destroy() {
    this.background.destroy();
  }
}
