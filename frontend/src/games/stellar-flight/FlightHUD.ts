import * as THREE from "three";
import { SpaceJourney, nextLevelXP } from "./SpaceJourney";
import { SHIPS } from "./ships";

/** Semantic instruments overlay; simulation remains independent of the DOM. */
export class FlightHUD {
  readonly root = document.createElement("div");
  private target = document.createElement("div");
  private radar = document.createElement("canvas");
  private point = new THREE.Vector3();
  private local = new THREE.Vector3();
  private inverse = new THREE.Quaternion();
  private raceNotice = 0;
  private races = 0;
  private canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.root.className = "flight-hud space-hud flagship-hud";
    this.root.setAttribute("aria-label", "Flight instruments");
    this.root.innerHTML = `<div class="space-location space-panel"><span class="space-eyebrow">FRONTIER</span><strong class="space-heading"></strong><span class="space-location-detail"></span></div>
      <div class="space-contract space-panel"><span class="space-eyebrow">NEXT OBJECTIVE</span><strong class="space-contract-title"></strong><span class="space-contract-detail"></span><progress class="space-contract-progress" max="100"></progress><span>H / L3 · Change contract (resets progress)</span></div>
      <div class="space-speed space-panel"><span class="space-eyebrow">VELOCITY</span><div><strong class="space-speed-value">120</strong><span>m/s</span></div><span class="space-trip"></span><span class="space-score"></span></div>
      <div class="space-race space-panel"><div class="space-race-heading"></div><div class="space-race-pips"></div><div class="space-race-detail"></div><span class="space-race-best"></span></div>
      <div class="space-fleet space-panel"><span class="space-eyebrow">YOUR SHIP</span><strong class="space-ship"></strong><span class="space-level"></span><div class="space-meters"><label>BOOST <progress class="space-energy" max="100" value="100"></progress></label><label>SHIELD <progress class="space-shield" max="100" value="100"></progress></label><label>UPGRADE <progress class="space-upgrade" max="100" value="0"></progress></label></div><span class="space-unlock"></span></div>
      <div class="space-event"><span class="space-status"></span></div><div class="space-race-result" hidden></div><div class="space-controls">WASD / arrows <span>steer</span> · Shift / RT <span>boost</span> · M / Y <span>new route</span> · V / X <span>ship</span> · N / B <span>explore</span> · C / R3 <span>camera</span> · H / L3 <span>contract</span></div><span class="sr-only space-instruments"></span>`;
    this.radar.width = this.radar.height = 112;
    this.radar.className = "space-radar";
    this.radar.setAttribute(
      "aria-label",
      "Nearby asteroids and navigation target",
    );
    this.root.querySelector(".space-location")!.appendChild(this.radar);
    this.target.className = "space-target flagship-target";
    this.target.setAttribute("aria-hidden", "true");
    canvas.parentElement?.append(this.root, this.target);
  }
  private text(selector: string, value: string) {
    const element = this.root.querySelector(selector)!;
    if (element.textContent !== value) element.textContent = value;
  }
  private meter(selector: string, value: number) {
    (this.root.querySelector(selector) as HTMLProgressElement).value = value;
  }
  update(journey: SpaceJourney, camera: THREE.PerspectiveCamera, dt: number) {
    this.raceNotice = Math.max(0, this.raceNotice - dt);
    if (journey.races !== this.races) {
      this.races = journey.races;
      this.raceNotice = 6;
    }
    const result = this.root.querySelector(".space-race-result") as HTMLElement;
    result.hidden = this.raceNotice <= 0 || !journey.lastRace;
    if (journey.lastRace) {
      result.dataset.medal = journey.lastRace.medal;
      result.textContent = `${journey.lastRace.medal.toUpperCase()} FLIGHT · ${journey.lastRace.time.toFixed(1)}s · ${journey.lastRace.passed}/5 rings · +${journey.lastRace.points.toLocaleString()} points`;
    }
    this.inverse.copy(journey.rotation).invert();
    this.point.fromArray(journey.target).sub(journey.position);
    const distance = this.point.length();
    this.local.copy(this.point).applyQuaternion(this.inverse);
    const directions = [
      this.local.z < 0
        ? "TARGET BEHIND · Turn around"
        : this.local.x > 40
          ? "← STEER LEFT"
          : this.local.x < -40
            ? "STEER RIGHT →"
            : "TARGET AHEAD",
      this.local.y > 45 ? "CLIMB ↑" : this.local.y < -45 ? "DIVE ↓" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    this.text(".space-heading", journey.currentSector.name);
    this.text(
      ".space-location-detail",
      `SECTOR ${journey.currentSector.key} · ${journey.visited.size} discovered · ${journey.scanned.size} surveyed`,
    );
    this.text(".space-speed-value", `${Math.floor(journey.controller.speed)}`);
    this.text(
      ".space-trip",
      `${(journey.distance / 1000).toFixed(1)} km travelled · ${journey.boosting ? "BOOST ACTIVE" : journey.boostLocked ? "Release boost to recharge" : "CRUISE ASSIST"}`,
    );
    this.text(
      ".space-score",
      `${journey.score.toLocaleString()} POINTS · CHAIN ×${journey.combo}`,
    );
    this.text(".space-ship", journey.specification.name);
    this.text(
      ".space-level",
      `LEVEL ${journey.level} · ${Math.round(journey.maxSpeed)} m/s top speed`,
    );
    const nextShip = SHIPS.find((ship) => ship.level > journey.level);
    this.text(
      ".space-unlock",
      nextShip
        ? `${nextShip.name} unlocks at level ${nextShip.level}`
        : `${journey.specification.role} · V / X`,
    );
    this.meter(".space-energy", journey.energy);
    this.meter(".space-shield", journey.shield);
    const start = nextLevelXP(journey.level - 1),
      end = nextLevelXP(journey.level);
    this.meter(".space-upgrade", ((journey.xp - start) / (end - start)) * 100);
    const contract = journey.contract;
    this.text(".space-contract-title", contract.title);
    this.text(
      ".space-contract-detail",
      `${contract.detail} · ${Math.floor(contract.progress)}/${contract.target} · +${contract.reward} XP`,
    );
    this.meter(
      ".space-contract-progress",
      (contract.progress / contract.target) * 100,
    );
    this.text(
      ".space-race-heading",
      journey.navigation === "race"
        ? `${journey.routeName} / ${journey.raceTime.toFixed(1)}s`
        : `SURVEY / ${journey.landmark}`,
    );
    this.text(
      ".space-race-pips",
      journey.navigation === "race"
        ? Array.from({ length: 5 }, (_, i) =>
            i < journey.gateIndex ? "◆" : "◇",
          ).join("  ")
        : "◌  FIND THE VIOLET BEACON  ◌",
    );
    this.text(
      ".space-race-detail",
      `${directions} · ${Math.round(distance)} m`,
    );
    this.text(
      ".space-race-best",
      journey.navigation === "race"
        ? `Gold target ${journey.racePar.toFixed(1)}s${journey.bestPace !== null ? ` · Best pace ${journey.bestPace.toFixed(1)}s/km` : " · Clean rings refill boost"}`
        : journey.scanned.has(journey.currentSector.key)
          ? "Survey complete · Explore another sector"
          : "Survey reward +350 XP · Full boost + shield refill",
    );
    this.text(".space-status", journey.messageTime > 0 ? journey.message : "");
    this.root
      .querySelector(".space-event")!
      .classList.toggle("is-visible", journey.messageTime > 0);
    this.root.classList.toggle("flight-warning", journey.invulnerable > 0);
    this.root.classList.toggle("is-boosting", journey.boosting);
    this.root.dataset.navigation = journey.navigation;
    this.root.dataset.camera = journey.cameraView;
    this.text(
      ".space-instruments",
      `Speed ${Math.floor(journey.controller.speed)} m/s · Gates ${journey.gatesPassed} cleared · ${journey.gatesMissed} missed · ${journey.nearMisses} close passes`,
    );
    this.point.project(camera);
    const behind = this.local.z < 0;
    const offscreen =
      behind || Math.abs(this.point.x) > 0.86 || Math.abs(this.point.y) > 0.72;
    const vertical = Math.abs(this.local.y) > Math.abs(this.local.x);
    const x = behind
      ? vertical
        ? 0
        : this.local.x >= 0
          ? -0.86
          : 0.86
      : Math.max(-0.86, Math.min(0.86, this.point.x));
    const y = behind
      ? vertical
        ? this.local.y >= 0
          ? 0.72
          : -0.72
        : 0
      : Math.max(-0.72, Math.min(0.72, this.point.y));
    this.target.style.left = `${this.canvas.offsetLeft + ((x + 1) * this.canvas.clientWidth) / 2}px`;
    this.target.style.top = `${this.canvas.offsetTop + ((1 - y) * this.canvas.clientHeight) / 2}px`;
    this.target.dataset.offscreen = String(offscreen);
    this.target.dataset.navigation = journey.navigation;
    this.target.textContent = `${offscreen ? (vertical ? (this.local.y > 0 ? "↑" : "↓") : x < 0 ? "←" : "→") : "◇"} ${journey.navigation === "race" ? "RING" : "SURVEY"} · ${Math.round(distance)} m`;
    this.target.hidden = false;
    const context = this.radar.getContext("2d");
    if (context) {
      context.clearRect(0, 0, 112, 112);
      context.strokeStyle = "#79bdd330";
      context.lineWidth = 1;
      for (const radius of [24, 48]) {
        context.beginPath();
        context.arc(56, 56, radius, 0, Math.PI * 2);
        context.stroke();
      }
      context.beginPath();
      context.moveTo(56, 8);
      context.lineTo(56, 104);
      context.moveTo(8, 56);
      context.lineTo(104, 56);
      context.stroke();
      context.fillStyle = "#799ab7";
      for (const sector of journey.sectors)
        for (const body of sector.asteroids) {
          this.point
            .fromArray(body.position)
            .sub(journey.position)
            .applyQuaternion(this.inverse);
          if (this.point.lengthSq() > 1800 ** 2) continue;
          context.fillRect(
            55 - (this.point.x / 1800) * 48,
            55 - (this.point.z / 1800) * 48,
            2,
            2,
          );
        }
      const length = Math.hypot(this.local.x, this.local.z) || 1;
      context.fillStyle = journey.navigation === "race" ? "#ffd890" : "#c2a1ff";
      context.beginPath();
      context.arc(
        56 - (this.local.x / length) * 41,
        56 - (this.local.z / length) * 41,
        3,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.fillStyle = "#9ee9ff";
      context.beginPath();
      context.moveTo(56, 51);
      context.lineTo(52, 61);
      context.lineTo(60, 61);
      context.closePath();
      context.fill();
    }
  }
  destroy() {
    this.root.remove();
    this.target.remove();
  }
}
