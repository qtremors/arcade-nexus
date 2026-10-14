import * as THREE from "three";
import { ROUTES } from "./routes";
import { z } from "zod";
import type { InputState } from "../../sdk/GameSDK";
import { Random } from "../../sdk/Random";
import { FlightController } from "./FlightController";
import { crossGate } from "./course";
import { SHIPS, type ShipId } from "./ships";
import { contracts, contractFor, type JourneyCounters } from "./contracts";
import {
  SectorStream,
  sectorCoordinates,
  sectorKey,
  intersectsBody,
  type Coordinates,
  type Sector,
  type SpaceBody,
} from "./universe";

const count = z.number().int().min(0).max(1e12);
const positive = z.number().min(0).max(1e15);
const vector = z.tuple([
  z.number().min(-1e15).max(1e15),
  z.number().min(-1e15).max(1e15),
  z.number().min(-1e15).max(1e15),
]);
const quaternion = z
  .tuple([
    z.number().min(-1).max(1),
    z.number().min(-1).max(1),
    z.number().min(-1).max(1),
    z.number().min(-1).max(1),
  ])
  .refine((q) => Math.abs(q.reduce((sum, n) => sum + n * n, 0) - 1) < 0.01);
const gateSchema = z.object({ position: vector, rotation: quaternion });
const countersSchema = z.object({
  gates: positive,
  sectors: positive,
  closePasses: positive,
  distance: positive,
  races: positive,
});
const raceResultSchema = z.object({
  time: positive,
  passed: z.number().int().min(0).max(5),
  medal: z.enum(["gold", "silver", "bronze"]),
  points: count,
  pace: positive.default(0),
});
const journeySchema = z
  .object({
    version: z.literal(2),
    mode: z.literal("endless"),
    seed: z.number().int().min(0).max(0xffffffff),
    rng: z.number().int().min(0).max(0xffffffff),
    position: vector,
    rotation: quaternion,
    speed: z.number().min(0).max(2000),
    bestSpeed: z.number().min(0).max(2000),
    maxAltitude: positive,
    routeHeld: z.boolean(),
    shipHeld: z.boolean(),
    elapsed: positive,
    distance: positive,
    xp: positive,
    score: z.number().int().min(0).max(2147483647),
    ship: z.enum(["jet", "dart", "twin", "crescent"]),
    energy: z.number().min(0).max(100),
    shield: z.number().min(0).max(100),
    boostLocked: z.boolean(),
    invulnerable: z.number().min(0).max(3),
    gatesPassed: count,
    gatesMissed: count,
    combo: count,
    bestCombo: count,
    races: count,
    collisions: count,
    nearMisses: count,
    nearMissCooldown: z.number().min(0).max(2),
    raceTime: positive.default(0),
    racePar: positive.default(30),
    bestRace: positive.nullable().default(null),
    bestPace: positive.nullable().default(null),
    raceLength: positive.default(0),
    lastRace: raceResultSchema.nullable().default(null),
    contractIndex: count.default(0),
    contractHeld: z.boolean().default(false),
    contractChoice: z
      .number()
      .int()
      .min(0)
      .max(contracts.length - 1)
      .optional(),
    routeStyle: z
      .number()
      .int()
      .min(0)
      .max(ROUTES.length - 1)
      .default(0),
    contractBaseline: countersSchema.default({
      gates: 0,
      sectors: 1,
      closePasses: 0,
      distance: 0,
      races: 0,
    }),
    scanned: z
      .array(z.string().regex(/^-?\d+:-?\d+:-?\d+$/))
      .max(1000000)
      .default([]),
    navigation: z.enum(["race", "explore"]).default("race"),
    navigationHeld: z.boolean().default(false),
    cameraView: z.enum(["chase", "nose", "wide"]).default("chase"),
    cameraHeld: z.boolean().default(false),
    pitchVelocity: z.number().min(-2).max(2).default(0),
    yawVelocity: z.number().min(-2).max(2).default(0),
    racePassed: z.number().int().min(0).max(5),
    gateIndex: z.number().int().min(0).max(4),
    gates: z.array(gateSchema).length(5),
    visited: z
      .array(z.string().regex(/^-?\d+:-?\d+:-?\d+$/))
      .min(1)
      .max(1000000),
  })
  .superRefine((state, context) => {
    const level = levelForXP(state.xp);
    if (SHIPS.find((s) => s.id === state.ship)!.level > level)
      context.addIssue({
        code: "custom",
        message: "Ship has not been unlocked",
      });
    if (
      state.racePassed > state.gateIndex ||
      state.combo > state.bestCombo ||
      new Set(state.visited).size !== state.visited.length ||
      new Set(state.scanned).size !== state.scanned.length
    )
      context.addIssue({
        code: "custom",
        message: "Inconsistent journey progress",
      });
  });
const legacySchema = z.object({
  version: z.literal(1),
  mode: z.enum(["classic", "course"]).default("classic"),
  position: vector,
  rotation: quaternion,
  speed: z.number().min(0).max(450),
  bestSpeed: z.number().min(0).max(450),
  elapsed: positive.default(0),
  maxAltitude: positive,
  map: z.number().int().min(0).max(2),
  gatesPassed: count.default(0),
  gatesMissed: count.default(0),
  gate: gateSchema.nullable().default(null),
});
export function levelForXP(xp: number): number {
  return 1 + Math.floor(Math.sqrt(xp / 400));
}
export function nextLevelXP(level: number): number {
  return 400 * level * level;
}

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
  private previous = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private gateRotation = new THREE.Quaternion();
  private turn = new THREE.Quaternion();
  private yawAxis = new THREE.Vector3(0, 1, 0);
  private pitchAxis = new THREE.Vector3(1, 0, 0);

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
    const before = this.level;
    this.xp += xp;
    this.score = Math.min(2147483647, this.score + Math.floor(points));
    if (this.level > before) {
      const unlock = SHIPS.filter(
        (ship) => ship.level > before && ship.level <= this.level,
      ).map((ship) => ship.name);
      this.notify(
        `LEVEL ${this.level} · Engine + handling upgraded${unlock.length ? ` · ${unlock.join(" / ")} unlocked · V / X to switch` : ""}`,
      );
    }
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
    this.gates = [];
    const point = this.position.clone();
    const rotation = this.rotation.clone();
    const routeSectors = new SectorStream();
    const spacing = Math.max(550, this.controller.speed * 3);
    for (let i = 0; i < 5; i++) {
      if (i > 0) {
        rotation.multiply(
          new THREE.Quaternion().setFromAxisAngle(
            this.yawAxis,
            ROUTES[this.routeStyle].yaw[i],
          ),
        );
        rotation.multiply(
          new THREE.Quaternion().setFromAxisAngle(
            this.pitchAxis,
            ROUTES[this.routeStyle].pitch[i],
          ),
        );
      }
      const step = new THREE.Vector3(
        0,
        0,
        i === 0 && first ? 500 : spacing,
      ).applyQuaternion(rotation);
      point.add(step);
      // Rings sit outside solid bodies; their connecting flight path still requires piloting.
      for (const sector of routeSectors.nearby(
        point.toArray() as Coordinates,
        this.seed,
      )) {
        for (const body of [
          ...sector.asteroids,
          ...(sector.planet ? [sector.planet] : []),
        ]) {
          const away = point.clone().sub(new THREE.Vector3(...body.position));
          if (away.length() < body.radius + 100) {
            if (away.lengthSq() === 0) away.set(1, 0, 0);
            point.copy(
              new THREE.Vector3(...body.position).add(
                away.setLength(body.radius + 100),
              ),
            );
          }
        }
      }
      this.gates.push({
        position: point.toArray() as Coordinates,
        rotation: rotation.toArray() as [number, number, number, number],
      });
    }
    this.gateIndex = 0;
    this.racePassed = 0;
    this.raceTime = 0;
    let length = 0,
      previous = this.position.clone();
    for (const gate of this.gates) {
      const next = new THREE.Vector3(...gate.position);
      length += previous.distanceTo(next);
      previous = next;
    }
    this.raceLength = length;
    this.racePar = length / (this.maxSpeed * 0.65) + 2;
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
  update(deltaTime: number, input: InputState): boolean {
    const dt = Math.max(0, Math.min(deltaTime / 1000, 0.1));
    this.event = null;
    this.nearMissCooldown = Math.max(0, this.nearMissCooldown - dt);
    this.elapsed += dt;
    if (this.navigation === "race") this.raceTime += dt;
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
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
    const requestedBoost = !!(
      input.action ||
      input.keys.ShiftLeft ||
      input.keys.ShiftRight ||
      (input.throttle ?? 0) > 0
    );
    if (!requestedBoost) this.boostLocked = false;
    this.boosting = requestedBoost && !this.boostLocked && this.energy > 0;
    this.energy = Math.max(
      0,
      Math.min(
        100,
        this.energy +
          dt *
            (this.boosting
              ? -this.specification.boostDrain
              : this.specification.recharge + Math.min(20, this.level) * 0.3),
      ),
    );
    if (this.boosting && this.energy === 0) this.boostLocked = true;
    this.shield = Math.min(
      100,
      this.shield +
        (this.invulnerable > 0 ? 0 : dt * this.specification.shieldRegen),
    );
    const braking = !!(
      input.keys.ControlLeft ||
      input.keys.ControlRight ||
      (input.throttle ?? 0) < 0
    );
    const cruise =
      (140 + Math.log2(this.level) * 18) * this.specification.speed;
    this.controller.minSpeed = 35;
    this.controller.maxSpeed = this.maxSpeed;
    this.controller.acceleration =
      this.specification.acceleration + Math.min(20, this.level) * 3;
    this.controller.deceleration = 160;
    this.controller.update(dt, {
      ...input,
      action: false,
      throttle: this.boosting ? 1 : braking ? -1 : 0,
      keys: {
        ...input.keys,
        ShiftLeft: this.boosting,
        ShiftRight: false,
        ControlLeft: braking,
        ControlRight: false,
      },
    });
    if (!this.boosting && !braking)
      this.controller.speed +=
        (cruise - this.controller.speed) * Math.min(1, dt * 0.7);
    const handling =
      this.specification.handling * (1 + Math.log2(this.level) * 0.035);
    const response = 1 - Math.exp(-dt * 10);
    const authority = this.boosting ? 0.86 : 1;
    this.pitchVelocity +=
      (this.controller.inputPitch * 0.8 * handling * authority -
        this.pitchVelocity) *
      response;
    this.yawVelocity +=
      (Math.max(
        -1.25,
        Math.min(
          1.25,
          this.controller.inputYaw + this.controller.inputRoll * 1.25,
        ),
      ) *
        0.7 *
        handling *
        authority -
        this.yawVelocity) *
      response;
    // Smooth steering preserves direct control without abrupt camera motion.
    this.turn.setFromAxisAngle(this.pitchAxis, this.pitchVelocity * dt);
    this.rotation.multiply(this.turn);
    this.turn.setFromAxisAngle(this.yawAxis, this.yawVelocity * dt);
    this.rotation.multiply(this.turn).normalize();
    this.previous.copy(this.position);
    this.forward.set(0, 0, 1).applyQuaternion(this.rotation);
    const travel = this.controller.speed * dt;
    this.position.addScaledVector(this.forward, travel);
    this.distance += travel;
    const distanceXP =
      Math.floor(this.distance / 1000) -
      Math.floor((this.distance - travel) / 1000);
    if (distanceXP > 0) this.reward(distanceXP * 40, distanceXP * 100);
    this.bestSpeed = Math.max(this.bestSpeed, this.controller.speed);
    this.maxAltitude = Math.max(this.maxAltitude, this.position.y);
    this.refreshSectors();
    if (!this.visited.has(this.sector)) {
      this.visited.add(this.sector);
      this.notify(`DISCOVERED ${this.currentSector.name} · +200 XP`);
      this.reward(200, 300);
    }
    const before = this.previous.toArray() as Coordinates,
      after = this.position.toArray() as Coordinates;
    if (this.invulnerable === 0) {
      let closePass = false;
      const body = this.collisionBodies.find((body) => {
        if (intersectsBody(before, after, body)) return true;
        if (body.radius < 100 && intersectsBody(before, after, body, 30))
          closePass = true;
        return false;
      });
      if (body) {
        this.collisions++;
        const absorbed = this.shield >= 40;
        this.shield = Math.max(0, this.shield - this.specification.impactCost);
        this.energy = Math.max(0, this.energy - (absorbed ? 15 : 30));
        this.controller.speed = Math.max(
          35,
          this.controller.speed * (absorbed ? 0.78 : 0.5),
        );
        this.combo = 0;
        this.invulnerable = 3;
        this.pitchVelocity = 0;
        this.yawVelocity = 0;
        const escape = this.position
          .clone()
          .sub(new THREE.Vector3(...body.position));
        if (escape.lengthSq() < 0.001) escape.copy(this.forward).negate();
        this.position.copy(
          new THREE.Vector3(...body.position).add(
            escape.setLength(body.radius + 12),
          ),
        );
        this.previous.copy(this.position);
        this.refreshSectors();
        this.notify(
          absorbed
            ? "SHIELD ABSORBED IMPACT · Keep flying"
            : "HULL RECOVERED · Progress kept · Shield recharging",
        );
        this.event = "hit";
      } else if (closePass && this.nearMissCooldown === 0) {
        this.nearMisses++;
        this.nearMissCooldown = 2;
        this.energy = Math.min(100, this.energy + 10);
        this.notify("CLOSE PASS · +60 XP · Boost recovered");
        this.reward(60, 200);
        this.event = "collect";
      }
    }
    if (
      this.navigation === "explore" &&
      !this.scanned.has(this.currentSector.key) &&
      this.position.distanceTo(
        new THREE.Vector3(...this.currentSector.beacon),
      ) < 100
    ) {
      this.scanned.add(this.currentSector.key);
      this.energy = 100;
      this.shield = 100;
      this.notify("SECTOR SURVEYED · +350 XP · Boost + shields replenished");
      this.reward(350, 800);
      this.event = "collect";
    }
    const gate = this.currentGate;
    this.gateRotation.fromArray(gate.rotation);
    this.normal.set(0, 0, 1).applyQuaternion(this.gateRotation);
    const crossing = crossGate(
      this.previous.toArray(),
      this.position.toArray(),
      gate.position,
      this.normal.toArray(),
      68,
    );
    // Flying elsewhere in the open world must not count as an unlimited plane miss.
    if (
      this.navigation === "race" &&
      crossing &&
      this.position.distanceTo(new THREE.Vector3(...gate.position)) < 500
    ) {
      if (crossing === "pass") {
        const local = this.position
          .clone()
          .sub(new THREE.Vector3(...gate.position));
        const offset = local
          .addScaledVector(this.normal, -local.dot(this.normal))
          .length();
        const precision = offset < 22;
        this.gatesPassed++;
        this.racePassed++;
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.energy = Math.min(100, this.energy + 25);
        this.notify(
          `GATE CLEARED${precision ? " · PERFECT CENTER" : ""} · Chain ×${this.combo} · +${100 + Math.min(10, this.combo) * 20} XP`,
        );
        this.reward(
          100 + Math.min(10, this.combo) * 20,
          500 + Math.min(10, this.combo) * 100 + (precision ? 150 : 0),
        );
        this.event = "collect";
      } else {
        this.gatesMissed++;
        this.combo = 0;
        this.notify("GATE MISSED · Keep flying, another ring ahead");
        this.event = "miss";
      }
      this.gateIndex++;
      if (this.gateIndex === this.gates.length) {
        this.races++;
        const clean = this.racePassed === 5;
        const medal =
          clean && this.raceTime <= this.racePar
            ? "gold"
            : this.racePassed >= 4
              ? "silver"
              : "bronze";
        const points =
          (clean ? 3000 : 1000) +
          Math.max(0, Math.floor((this.racePar - this.raceTime) * 80));
        const pace = this.raceTime / Math.max(0.1, this.raceLength / 1000);
        if (clean)
          this.bestPace =
            this.bestPace === null ? pace : Math.min(this.bestPace, pace);
        this.lastRace = {
          pace,
          time: this.raceTime,
          passed: this.racePassed,
          medal,
          points,
        };
        if (clean)
          this.bestRace =
            this.bestRace === null
              ? this.raceTime
              : Math.min(this.bestRace, this.raceTime);
        this.notify(
          `RACE ${this.races} COMPLETE · ${medal.toUpperCase()} · ${this.raceTime.toFixed(1)}s · Next race ahead`,
        );
        this.reward(clean ? 1000 : 400, points);
        this.newRoute();
      }
    }
    const contract = this.contract;
    if (contract.progress >= contract.target) {
      this.contractIndex++;
      this.contractChoice = (this.contractChoice + 1) % contracts.length;
      this.contractBaseline = this.counters;
      this.notify(
        `CONTRACT COMPLETE · ${contract.title} · +${contract.reward} XP`,
      );
      this.reward(contract.reward, contract.reward * 2);
      this.event = "collect";
    }
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
