import { FlightMotion } from "./flightMotion";
import { RaceProgression } from "./raceProgression";
import { advanceCollisions } from "./collisionPolicy";
import {
  applyReward,
  advanceContract,
  discoverSector,
  surveySector,
} from "./progressionPolicy";
import { planRoute } from "./racePolicy";
import type { z } from "zod";
import {
  legacySchema,
  journeySchema,
  levelForXP,
  raceResultSchema,
  gateSchema,
} from "./codec";
export { levelForXP, nextLevelXP } from "./codec";
import * as THREE from "three";
import { ROUTES } from "./routes";
import type { InputState } from "../../sdk/GameSDK";
import { Random } from "../../sdk/Random";
import { FlightController } from "./FlightController";
import { SHIPS, type ShipId } from "./ships";
import { contracts, contractFor, type JourneyCounters } from "./contracts";
import {
  SectorStream,
  sectorCoordinates,
  sectorKey,
  type Coordinates,
  type Sector,
  type SpaceBody,
} from "./universe";

/** Rendering-independent simulation: all durable progression lives in the save. */
export class SpaceJourney {
  position = new THREE.Vector3();
  rotation = new THREE.Quaternion();
  controller = new FlightController();
  seed: number;
  random: Random;
  elapsed = 0;
  distance = 0;
  xp = 0;
  score = 0;
  ship: ShipId = "dart";
  energy = 100;
  shield = 100;
  boostLocked = false;
  boosting = false;
  invulnerable = 0;
  bestSpeed = 120;
  maxAltitude = 0;
  raceObstacles: SpaceBody[] = [];
  gatesPassed = 0;
  gatesMissed = 0;
  combo = 0;
  bestCombo = 0;
  races = 0;
  collisions = 0;
  nearMisses = 0;
  nearMissCooldown = 0;
  raceTime = 0;
  racePar = 30;
  bestRace: number | null = null;
  bestPace: number | null = null;
  raceLength = 0;
  lastRace: z.infer<typeof raceResultSchema> | null = null;
  contractIndex = 0;
  contractChoice = 0;
  routeStyle = 0;
  private contractHeld = false;
  get routeName() {
    return ROUTES[this.routeStyle].name;
  }
  get landmark() {
    const target = this.target;
    return (
      this.sectors.find((sector) =>
        sector.beacon.every((v, i) => v === target[i]),
      )?.landmark ?? this.currentSector.landmark
    );
  }
  cycleContract() {
    this.contractChoice = (this.contractChoice + 1) % contracts.length;
    this.contractBaseline = this.counters;
    this.notify(`NEW CONTRACT · ${this.contract.title} · Progress starts now`);
  }
  contractBaseline: JourneyCounters = {
    gates: 0,
    sectors: 1,
    closePasses: 0,
    distance: 0,
    races: 0,
  };
  scanned = new Set<string>();
  navigation: "race" | "explore" = "race";
  private navigationHeld = false;
  cameraView: "chase" | "nose" | "wide" = "chase";
  private cameraHeld = false;
  pitchVelocity = 0;
  yawVelocity = 0;
  private collisionBodies: SpaceBody[] = [];
  racePassed = 0;
  gateIndex = 0;
  gates: z.infer<typeof gateSchema>[] = [];
  visited = new Set<string>();
  sectors: Sector[] = [];
  message = "Open space · Follow the rings or choose your own heading";
  messageTime = 5;
  event: "collect" | "miss" | "hit" | null = null;
  private routeHeld = false;
  private shipHeld = false;
  private sector = "";
  private sectorStream = new SectorStream();
  private motion = new FlightMotion();
  private raceProgression = new RaceProgression();
  private effects = {
    notify: (message: string) => this.notify(message),
    reward: (xp: number, points: number) => this.reward(xp, points),
    newRoute: () => this.newRoute(),
    refreshSectors: () => this.refreshSectors(),
  };

  constructor(seed = Math.floor(Math.random() * 0x100000000)) {
    this.seed = seed >>> 0;
    this.random = new Random(this.seed);
    this.controller.speed = 120;
    this.refreshSectors();
    this.visited.add(this.sector);
    this.newRoute(true);
  }
  get level(): number {
    return levelForXP(this.xp);
  }
  get specification() {
    return SHIPS.find((ship) => ship.id === this.ship)!;
  }
  get maxSpeed(): number {
    return (450 + Math.log2(this.level) * 45) * this.specification.speed;
  }
  get currentSector(): Sector {
    return this.sectors.find((sector) => sector.key === this.sector)!;
  }
  get currentGate() {
    return this.gates[this.gateIndex];
  }
  get counters(): JourneyCounters {
    return {
      gates: this.gatesPassed,
      sectors: this.visited.size,
      closePasses: this.nearMisses,
      distance: this.distance / 1000,
      races: this.races,
    };
  }
  get contract() {
    return contractFor(
      this.contractIndex,
      this.contractBaseline,
      this.counters,
      this.contractChoice,
    );
  }
  get target(): Coordinates {
    if (this.navigation === "race") return this.currentGate.position;
    if (!this.scanned.has(this.currentSector.key))
      return this.currentSector.beacon;
    let nearest = this.currentSector.beacon,
      distance = Infinity;
    for (const sector of this.sectors) {
      if (this.scanned.has(sector.key)) continue;
      const squared = sector.beacon.reduce(
        (sum, value, i) => sum + (value - this.position.getComponent(i)) ** 2,
        0,
      );
      if (squared < distance) {
        distance = squared;
        nearest = sector.beacon;
      }
    }
    return nearest;
  }
  private refreshBodies() {
    this.collisionBodies = [
      ...this.sectors.flatMap((sector) => [
        ...sector.asteroids,
        ...(sector.planet ? [sector.planet] : []),
      ]),
      ...this.raceObstacles,
    ];
  }
  private notify(message: string) {
    this.message = message;
    this.messageTime = 4;
  }
  private reward(xp: number, points: number) {
    applyReward(this, xp, points, (message) => this.notify(message));
  }

  private refreshSectors() {
    const key = sectorKey(
      sectorCoordinates(this.position.toArray() as Coordinates),
    );
    if (key === this.sector) return;
    this.sector = key;
    this.sectors = this.sectorStream.nearby(
      this.position.toArray() as Coordinates,
      this.seed,
    );
    this.refreshBodies();
  }
  newRoute(first = false) {
    this.routeStyle = first
      ? 0
      : (this.routeStyle +
          1 +
          Math.floor(this.random.next() * (ROUTES.length - 1))) %
        ROUTES.length;
    const route = planRoute({
      position: this.position,
      rotationValue: this.rotation,
      seed: this.seed,
      speed: this.controller.speed,
      style: this.routeStyle,
      maxSpeed: this.maxSpeed,
      first,
    });
    this.gates = route.gates;
    this.gateIndex = 0;
    this.racePassed = 0;
    this.raceTime = 0;
    this.raceLength = route.length;
    this.racePar = route.par;
    this.refreshRaceObstacles();
  }
  private refreshRaceObstacles() {
    this.raceObstacles = this.gates.flatMap((gate, index) => {
      const rotation = new THREE.Quaternion().fromArray(gate.rotation);
      return [-1, 1].map((side) => ({
        position: new THREE.Vector3(
          side * (125 + (index % 3) * 25),
          side * 25,
          -190,
        )
          .applyQuaternion(rotation)
          .add(new THREE.Vector3(...gate.position))
          .toArray() as Coordinates,
        radius: 38 + (index % 3) * 7,
      }));
    });
    this.refreshBodies();
  }
  switchShip() {
    const unlocked = SHIPS.filter((ship) => ship.level <= this.level);
    this.ship =
      unlocked[
        (unlocked.findIndex((ship) => ship.id === this.ship) + 1) %
          unlocked.length
      ].id;
    this.notify(`${this.specification.name} · ${this.specification.role}`);
  }
  private handleCommands(input: InputState) {
    const camera = !!input.keys.KeyC;
    if (camera && (!this.cameraHeld || input.pressed?.includes("KeyC"))) {
      const views = ["chase", "nose", "wide"] as const;
      this.cameraView =
        views[(views.indexOf(this.cameraView) + 1) % views.length];
      this.notify(
        `${this.cameraView.toUpperCase()} CAMERA · C / right stick click to change view`,
      );
    }
    this.cameraHeld = camera;
    const chooseContract = !!input.keys.KeyH;
    if (
      chooseContract &&
      (!this.contractHeld || input.pressed?.includes("KeyH"))
    )
      this.cycleContract();
    this.contractHeld = chooseContract;
    const navigation = !!input.keys.KeyN;
    if (
      navigation &&
      (!this.navigationHeld || input.pressed?.includes("KeyN"))
    ) {
      this.navigation = this.navigation === "race" ? "explore" : "race";
      if (this.navigation === "race") {
        this.newRoute();
        this.combo = 0;
      }
      this.notify(
        this.navigation === "explore"
          ? "EXPLORATION · Follow the violet survey beacon · N / B to return to racing"
          : "RACING · Fresh route ahead · Follow the gold rings",
      );
    }
    this.navigationHeld = navigation;
    const route = !!input.keys.KeyM;
    if (route && (!this.routeHeld || input.pressed?.includes("KeyM"))) {
      this.navigation = "race";
      this.newRoute();
      this.combo = 0;
      this.notify(`${this.routeName} · New race plotted ahead`);
    }
    this.routeHeld = route;
    const ship = !!input.keys.KeyV;
    if (ship && (!this.shipHeld || input.pressed?.includes("KeyV")))
      this.switchShip();
    this.shipHeld = ship;
  }
  update(deltaTime: number, input: InputState): boolean {
    const dt = Math.max(0, Math.min(deltaTime / 1000, 0.1));
    this.event = null;
    this.nearMissCooldown = Math.max(0, this.nearMissCooldown - dt);
    this.elapsed += dt;
    if (this.navigation === "race") this.raceTime += dt;
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.handleCommands(input);
    const travel = this.motion.advance(this, dt, input);
    this.distance += travel;
    const distanceXP =
      Math.floor(this.distance / 1000) -
      Math.floor((this.distance - travel) / 1000);
    if (distanceXP > 0) this.reward(distanceXP * 40, distanceXP * 100);
    this.bestSpeed = Math.max(this.bestSpeed, this.controller.speed);
    this.maxAltitude = Math.max(this.maxAltitude, this.position.y);
    this.refreshSectors();
    discoverSector(this, this.effects);
    advanceCollisions(this, this.motion, this.collisionBodies, this.effects);
    surveySector(this, this.effects);
    this.raceProgression.advance(this, this.motion.previous, this.effects);
    advanceContract(this, this.effects);
    return true;
  }
  getState(): Record<string, unknown> {
    return {
      version: 2,
      mode: "endless",
      seed: this.seed,
      rng: this.random.state,
      position: this.position.toArray(),
      rotation: this.rotation.toArray(),
      speed: this.controller.speed,
      bestSpeed: this.bestSpeed,
      maxAltitude: this.maxAltitude,
      routeHeld: this.routeHeld,
      shipHeld: this.shipHeld,
      elapsed: this.elapsed,
      distance: this.distance,
      xp: this.xp,
      score: this.score,
      ship: this.ship,
      energy: this.energy,
      shield: this.shield,
      boostLocked: this.boostLocked,
      invulnerable: this.invulnerable,
      gatesPassed: this.gatesPassed,
      gatesMissed: this.gatesMissed,
      combo: this.combo,
      bestCombo: this.bestCombo,
      races: this.races,
      collisions: this.collisions,
      nearMisses: this.nearMisses,
      nearMissCooldown: this.nearMissCooldown,
      raceTime: this.raceTime,
      racePar: this.racePar,
      bestRace: this.bestRace,
      bestPace: this.bestPace,
      raceLength: this.raceLength,
      lastRace: this.lastRace ? { ...this.lastRace } : null,
      contractIndex: this.contractIndex,
      contractHeld: this.contractHeld,
      contractChoice: this.contractChoice,
      routeStyle: this.routeStyle,
      contractBaseline: { ...this.contractBaseline },
      scanned: [...this.scanned],
      navigation: this.navigation,
      navigationHeld: this.navigationHeld,
      cameraView: this.cameraView,
      cameraHeld: this.cameraHeld,
      pitchVelocity: this.pitchVelocity,
      yawVelocity: this.yawVelocity,
      racePassed: this.racePassed,
      gateIndex: this.gateIndex,
      gates: this.gates.map((gate) => ({
        position: [...gate.position],
        rotation: [...gate.rotation],
      })),
      visited: [...this.visited],
    };
  }
  setState(state: Record<string, unknown>) {
    if (state.version === 1) {
      const legacy = legacySchema.parse(state);
      const fresh = new SpaceJourney(this.seed);
      this.setState(fresh.getState());
      this.position.fromArray(legacy.position);
      this.rotation.fromArray(legacy.rotation).normalize();
      this.controller.speed = legacy.speed;
      this.bestSpeed = legacy.bestSpeed;
      this.maxAltitude = legacy.maxAltitude;
      this.elapsed = legacy.elapsed;
      this.gatesPassed = legacy.gatesPassed;
      this.gatesMissed = legacy.gatesMissed;
      this.xp = legacy.gatesPassed * 120;
      this.score = Math.min(2147483647, legacy.gatesPassed * 600);
      this.sector = "";
      this.refreshSectors();
      this.visited = new Set([this.sector]);
      this.newRoute(true);
      this.notify("Flight save upgraded · Welcome to endless space");
      return;
    }
    const data = journeySchema.parse(state);
    this.seed = data.seed;
    this.random.state = data.rng;
    this.position.fromArray(data.position);
    this.rotation.fromArray(data.rotation);
    this.controller.speed = data.speed;
    for (const field of [
      "bestSpeed",
      "maxAltitude",
      "elapsed",
      "distance",
      "xp",
      "score",
      "energy",
      "shield",
      "invulnerable",
      "gatesPassed",
      "gatesMissed",
      "combo",
      "bestCombo",
      "races",
      "collisions",
      "nearMisses",
      "nearMissCooldown",
      "racePassed",
      "raceTime",
      "racePar",
      "raceLength",
      "contractIndex",
      "pitchVelocity",
      "yawVelocity",
      "gateIndex",
    ] as const)
      this[field] = data[field];
    this.bestRace = data.bestRace;
    this.bestPace = data.bestPace;
    this.lastRace = data.lastRace;
    this.contractBaseline = data.contractBaseline;
    this.contractChoice =
      data.contractChoice ?? data.contractIndex % contracts.length;
    this.routeStyle = data.routeStyle;
    this.contractHeld = data.contractHeld;
    this.scanned = new Set(data.scanned);
    this.navigation = data.navigation;
    this.navigationHeld = data.navigationHeld;
    this.cameraView = data.cameraView;
    this.cameraHeld = data.cameraHeld;
    this.ship = data.ship;
    this.boostLocked = data.boostLocked;
    this.gates = data.gates;
    this.refreshRaceObstacles();
    this.visited = new Set(data.visited);
    this.sector = "";
    this.refreshSectors();
    this.routeHeld = data.routeHeld;
    this.shipHeld = data.shipHeld;
    this.notify("Journey restored · Ship, upgrades and exploration retained");
  }
}
