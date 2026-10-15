import { PHRASES, BIOMES } from "./phrases";
import { gameEffects } from "../../sdk/RuntimePorts";
import type { GameFeedback } from "../feedback";
import type { RaptorView, Obstacle } from "./RaptorSimulation";
export function renderRaptor(
  ctx: CanvasRenderingContext2D,
  view: RaptorView,
  feedback: GameFeedback,
): void {
  const isNight = view.dayTime > 0.5;
  const biome = BIOMES[Math.floor(view.score / 750) % BIOMES.length];
  const skyTop = isNight ? "#151b36" : biome.top;
  const skyBottom = isNight ? "#47415e" : biome.bottom;
  const groundColor = isNight ? "#252735" : biome.ground;

  // Sky
  const grad = ctx.createLinearGradient(0, 0, 0, view.height);
  grad.addColorStop(0, skyTop);
  grad.addColorStop(1, skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, view.width, view.height);

  // Sun/Moon
  const celestialY = 155 + Math.sin(view.dayTime * Math.PI * 2) * 40;
  ctx.fillStyle = isNight ? "#e1e5f0" : "#ffe4bb";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 30 * ctx.getTransform().a;
  ctx.beginPath();
  ctx.arc(view.width - 100, celestialY, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Layered silhouettes and passing ground marks make speed legible.
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = isNight
      ? ["#20243f", "#26243d", "#302c40"][layer]
      : ["#8e879b", "#726d84", "#53596e"][layer];
    const offset = (view.distance * (0.04 + layer * 0.06)) % 600;
    const base = view.groundY - 70 - (2 - layer) * 65;
    ctx.beginPath();
    ctx.moveTo(-600, view.groundY);
    for (let i = -1; i <= 2; i++) {
      const x = i * 600 - offset;
      ctx.lineTo(x, base);
      ctx.bezierCurveTo(
        x + 50,
        base - 15,
        x + 75,
        base - 90,
        x + 115,
        base - 95,
      );
      ctx.lineTo(x + 205, base - 90);
      ctx.bezierCurveTo(
        x + 250,
        base - 80,
        x + 240,
        base + 10,
        x + 310,
        base + 15,
      );
      ctx.bezierCurveTo(
        x + 395,
        base + 30,
        x + 415,
        base - 45,
        x + 465,
        base - 55,
      );
      ctx.bezierCurveTo(x + 540, base - 65, x + 550, base - 15, x + 600, base);
    }
    ctx.lineTo(view.width, view.groundY);
    ctx.closePath();
    ctx.fill();
  }
  // Ground
  ctx.fillStyle = groundColor;
  ctx.fillRect(0, view.groundY, view.width, view.height - view.groundY);
  ctx.strokeStyle = isNight ? "#73718a" : "#aaa287";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, view.groundY);
  ctx.lineTo(view.width, view.groundY);
  ctx.stroke();
  ctx.fillStyle = isNight ? "#545269" : "#807472";
  for (let i = -1; i < 24; i++) {
    const x = i * 50 - (view.distance % 50);
    ctx.fillRect(x, view.groundY + 28 + (i % 3) * 12, 14, 3);
  }
  // Passing ferns and broken rock on the verge share the obstacle scroll speed.
  for (let i = -1; i < 8; i++) {
    const x = i * 180 - (view.distance % 180);
    ctx.strokeStyle = isNight ? "#3c665f" : "#759483";
    ctx.lineWidth = 2;
    for (let leaf = -2; leaf <= 2; leaf++) {
      ctx.beginPath();
      ctx.moveTo(x, view.groundY + 3);
      ctx.quadraticCurveTo(
        x + leaf * 5,
        view.groundY - 16,
        x + leaf * 12,
        view.groundY - 10,
      );
      ctx.stroke();
    }
  }

  // Particles
  ctx.fillStyle = "rgba(200, 180, 150, 0.7)";
  for (const p of view.particles) {
    if (gameEffects.reducedMotion()) break;
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Obstacles
  for (const obs of view.obstacles) drawObstacle(ctx, obs, view);

  // Raptor
  drawRaptor(ctx, view);

  // Score
  ctx.fillStyle = "#0f172ac9";
  ctx.beginPath();
  ctx.roundRect(30, 24, 900, 70, 12);
  ctx.fill();
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "600 15px Rajdhani, system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`RAPTOR RUN / ${biome.name}`, 50, 49);
  ctx.fillStyle = "#fff";
  ctx.font = "700 30px Rajdhani, system-ui";
  ctx.fillText(`${view.score} m`, 50, 79);
  ctx.textAlign = "right";
  ctx.font = "600 16px Rajdhani, system-ui";
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(
    `PACE ${Math.round(view.gameSpeed / 4)}%  ·  ${view.difficulty.toUpperCase()}`,
    910,
    55,
  );
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("SPACE  Jump     ↓  Duck", 910, 78);
  const nearest = view.obstacles
    .filter((o) => o.x + o.width > view.raptorX)
    .sort((a, b) => a.x - b.x)[0];
  if (
    nearest &&
    nearest.x < 480 &&
    nearest.type === "bird" &&
    nearest.y + nearest.height > view.groundY - 55
  ) {
    ctx.fillStyle = "#fee2e2";
    ctx.textAlign = "center";
    ctx.font = "700 20px Rajdhani, system-ui";
    ctx.fillText("↓ DUCK", nearest.x + nearest.width / 2, nearest.y - 18);
  }
  ctx.textAlign = "center";
  ctx.font = "16px Rajdhani, system-ui";
  ctx.fillStyle = "#e5efff";
  ctx.fillText(
    `${PHRASES[view.phraseIndex].name} · ${view.nearMisses} near misses`,
    view.width / 2,
    view.height - 24,
  );
  feedback.render(ctx);

  // Game over
  if (view.gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.fillStyle = "#ff6b6b";
    ctx.font = "bold 48px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CRASHED!", view.width / 2, view.height / 2 - 30);
    ctx.fillStyle = "#fff";
    ctx.font = "24px Inter, sans-serif";
    ctx.fillText(`Score: ${view.score}`, view.width / 2, view.height / 2 + 20);
  }
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obs: Obstacle,
  view: RaptorView,
): void {
  if (obs.type === "cactus") {
    ctx.fillStyle = "#c7a46c";
    ctx.beginPath();
    ctx.roundRect(
      obs.x + obs.width * 0.25,
      obs.y,
      obs.width * 0.5,
      obs.height,
      5,
    );
    ctx.fill();
    ctx.strokeStyle = "#c7a46c";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      const center = obs.x + obs.width / 2;
      ctx.beginPath();
      ctx.moveTo(center, obs.y + obs.height * 0.55);
      ctx.lineTo(center + side * obs.width * 0.4, obs.y + obs.height * 0.5);
      ctx.lineTo(center + side * obs.width * 0.4, obs.y + obs.height * 0.27);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.fillStyle = "#ecd5a0";
    ctx.fillRect(obs.x + obs.width * 0.4, obs.y + 6, 3, obs.height - 12);
  } else if (obs.type === "rock") {
    ctx.fillStyle = "#7f8c8d";
    ctx.beginPath();
    ctx.moveTo(obs.x, obs.y + obs.height);
    ctx.lineTo(obs.x + obs.width / 2, obs.y);
    ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
    ctx.closePath();
    ctx.fill();
  } else if (obs.type === "bird") {
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.ellipse(
      obs.x + obs.width / 2,
      obs.y + obs.height / 2,
      obs.width / 2,
      obs.height / 3,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    const flap = Math.sin(view.distance * 0.05) * 10;
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(obs.x + 10, obs.y + obs.height / 2);
    ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height / 2 - flap);
    ctx.lineTo(obs.x + obs.width - 10, obs.y + obs.height / 2);
    ctx.stroke();
  }
}

function drawRaptor(ctx: CanvasRenderingContext2D, view: RaptorView): void {
  const x = view.raptorX,
    y = view.isDucking ? view.raptorY + 30 : view.raptorY;
  ctx.fillStyle = "#09131d50";
  ctx.beginPath();
  const shadowSize = Math.max(
    12,
    30 - (view.groundY - view.raptorY - 60) * 0.08,
  );
  ctx.ellipse(x + 25, view.groundY + 2, shadowSize, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, view.isDucking ? 0.5 : 1);
  const stride = view.isJumping ? -4 : Math.sin(view.distance * 0.08) * 6;
  // Far leg and a long counterbalancing tail, behind the torso.
  ctx.strokeStyle = "#8e6648";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(33, 40);
  ctx.lineTo(40 - stride, 52);
  ctx.lineTo(33 - stride, view.isJumping ? 55 : 60);
  ctx.stroke();
  ctx.fillStyle = "#ba8858";
  ctx.beginPath();
  ctx.moveTo(20, 30);
  ctx.bezierCurveTo(-1, 27, -15, 14, -34, 18);
  ctx.bezierCurveTo(-12, 32, 0, 45, 23, 43);
  ctx.fill();
  // Curved back, powerful hips, long neck and forward-facing muzzle.
  ctx.fillStyle = "#efbd7b";
  ctx.beginPath();
  ctx.moveTo(10, 33);
  ctx.bezierCurveTo(9, 15, 21, 17, 27, 14);
  ctx.lineTo(30, 4);
  ctx.quadraticCurveTo(37, -4, 47, 2);
  ctx.lineTo(59, 8);
  ctx.lineTo(57, 19);
  ctx.lineTo(39, 22);
  ctx.lineTo(38, 31);
  ctx.bezierCurveTo(44, 42, 34, 49, 19, 45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffdb9e";
  ctx.beginPath();
  ctx.ellipse(28, 35, 13, 10, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Mouth, teeth, eye ridge and eye stay readable at the logical game size.
  ctx.strokeStyle = "#665344";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(42, 14);
  ctx.lineTo(58, 14);
  ctx.stroke();
  ctx.fillStyle = "#f6f0cf";
  for (const tooth of [46, 51, 56]) {
    ctx.beginPath();
    ctx.moveTo(tooth, 14);
    ctx.lineTo(tooth + 2, 18);
    ctx.lineTo(tooth + 3, 14);
    ctx.fill();
  }
  ctx.fillStyle = "#ecf3d9";
  ctx.beginPath();
  ctx.ellipse(40, 8, 4, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#102b32";
  ctx.fillRect(41, 6, 2, 4);
  ctx.strokeStyle = "#8e6648";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(35, 30);
  ctx.lineTo(43, 36);
  ctx.lineTo(48, 33);
  ctx.stroke();
  // Near leg has a bent knee and a distinct clawed foot.
  ctx.strokeStyle = "#d5a067";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(21, 41);
  ctx.lineTo(14 + stride, 52);
  ctx.lineTo(19 + stride, view.isJumping ? 57 : 60);
  ctx.stroke();
  ctx.strokeStyle = "#d4dda7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18 + stride, view.isJumping ? 57 : 60);
  ctx.lineTo(27 + stride, view.isJumping ? 57 : 60);
  ctx.stroke();
  ctx.fillStyle = "#ba8858";
  for (const scale of [
    [16, 27],
    [21, 24],
    [26, 23],
    [9, 29],
  ]) {
    ctx.beginPath();
    ctx.arc(scale[0], scale[1], 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
