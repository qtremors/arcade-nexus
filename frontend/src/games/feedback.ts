import { gameEffects } from "../sdk/RuntimePorts";

/** Cosmetic effects never enter a game's saved simulation state. */
export class GameFeedback {
  private particles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
  }[] = [];
  private labels: {
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
  }[] = [];

  burst(x: number, y: number, color: string, label?: string): void {
    if (label) {
      const existing = this.labels.find((item) => item.x === x && item.y === y);
      if (existing) {
        existing.text =
          /^\+\d+$/.test(label) && /^\+\d+$/.test(existing.text)
            ? `+${Number(label.slice(1)) + Number(existing.text.slice(1))}`
            : label;
        existing.life = 0.8;
        existing.color = color;
      } else this.labels.push({ x, y, color, text: label, life: 0.8 });
      this.labels = this.labels.slice(-12);
    }
    if (gameEffects.reducedMotion()) return;
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * 100,
        vy: Math.sin(angle) * 100,
        color,
        life: 0.4,
      });
    }
    this.particles = this.particles.slice(-120);
    this.labels = this.labels.slice(-12);
  }
  sound(cue: "hit" | "collect" | "jump" | "miss"): void {
    gameEffects.sound(cue);
  }
  update(milliseconds: number): void {
    const dt = milliseconds / 1000;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    for (const label of this.labels) {
      label.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this.labels = this.labels.filter((p) => p.life > 0);
  }
  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (!gameEffects.reducedMotion())
      for (const p of this.particles) {
        ctx.globalAlpha = Math.min(1, p.life / 0.2);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
    ctx.font = "bold 18px Rajdhani, system-ui";
    ctx.textAlign = "center";
    for (const label of this.labels) {
      ctx.globalAlpha = Math.min(1, label.life / 0.2);
      ctx.fillStyle = label.color;
      const offset = gameEffects.reducedMotion() ? 0 : (0.8 - label.life) * 32;
      ctx.fillText(label.text, label.x, label.y - offset);
    }
    ctx.restore();
  }
  clear(): void {
    this.particles = [];
    this.labels = [];
  }
}

/** Adapt application-owned audio/preferences and ephemeral feedback to pure rules. */
export function simulationEffects(
  feedback: GameFeedback,
): import("./simulationEffects").SimulationEffects {
  return {
    reducedMotion: () => gameEffects.reducedMotion(),
    update: (dt) => feedback.update(dt),
    sound: (cue) => feedback.sound(cue),
    burst: (x, y, color, label) => feedback.burst(x, y, color, label),
    clear: () => feedback.clear(),
  };
}
