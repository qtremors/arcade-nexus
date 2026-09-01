import type { z } from "zod";
import type { rockSchema } from "./codec";
type Rock = z.infer<typeof rockSchema>;
import type { AsteroidsView } from "./AsteroidsSimulation";
import type { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../shared/state/settingsStore";
export class AsteroidsRenderer {
  private feedback: GameFeedback;
  constructor(feedback: GameFeedback) {
    this.feedback = feedback;
  }

  render(ctx: CanvasRenderingContext2D, view: AsteroidsView): void {
    ctx.fillStyle = "#090f1f";
    ctx.fillRect(0, 0, 960, 640);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = i % 3 === 0 ? "#64728f" : "#29364e";
      ctx.fillRect((i * 137.7) % 960, (i * 83.3) % 640, 2, 2);
    }
    const drawRock = (rock: Rock, x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rock.angle);
      ctx.strokeStyle = rock.size === 1 ? "#ffbe83" : "#a8b8d0";
      ctx.lineWidth = rock.size === 1 ? 3 : 2;
      ctx.fillStyle = rock.size === 1 ? "#533b30" : "#162238";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5,
          radius = rock.size * 13 * (i % 2 ? 0.85 : 1.08);
        const px = Math.cos(angle) * radius,
          py = Math.sin(angle) * radius;
        if (!i) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    for (const rock of view.rocks)
      for (const dx of [-960, 0, 960])
        for (const dy of [-640, 0, 640])
          if (
            rock.x + dx > -45 &&
            rock.x + dx < 1005 &&
            rock.y + dy > -45 &&
            rock.y + dy < 685
          )
            drawRock(rock, rock.x + dx, rock.y + dy);
    ctx.fillStyle = "#b6f8ff";
    for (const b of view.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(view.ship.x, view.ship.y);
    ctx.rotate(view.ship.angle);
    if (view.invulnerable > 0) {
      ctx.strokeStyle = "#73e6ed";
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = "#73e6ed";
    ctx.fillStyle = "#122c40";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -11);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (view.thrust) {
      const flame = useSettingsStore.getState().reducedMotion
        ? 23
        : 23 + Math.sin(view.elapsed * 40) * 5;
      ctx.strokeStyle = "#ffbe83";
      ctx.beginPath();
      ctx.moveTo(-11, -5);
      ctx.lineTo(-flame, 0);
      ctx.lineTo(-11, 5);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#090f1fcc";
    ctx.fillRect(0, 0, 960, 84);
    ctx.textAlign = "left";
    ctx.font = "28px Rajdhani, system-ui";
    ctx.fillStyle = "#ffbe83";
    ctx.fillText("ASTEROIDS", 30, 40);
    ctx.font = "20px Rajdhani, system-ui";
    ctx.fillStyle = "#d6e3f5";
    ctx.fillText(
      `WAVE ${view.wave}   ·   ${view.score} POINTS   ·   ${view.rocks.length} ROCKS`,
      30,
      68,
    );
    ctx.textAlign = "right";
    ctx.fillText(`${view.lives} HULLS`, 925, 40);
    ctx.font = "16px Rajdhani, system-ui";
    ctx.fillText("↑ Thrust   ↓ Brake   ← → Turn   Space / A Fire", 925, 67);
    this.feedback.render(ctx);
  }
  destroy() {}
}
