import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SpaceJourney, levelForXP } from "../games/stellar-flight/SpaceJourney";
import {
  createSector,
  nearbySectors,
  intersectsBody,
  SectorStream,
} from "../games/stellar-flight/universe";
import { createShip } from "../games/stellar-flight/ships";
import { validateSave } from "../services/saves";
import type { InputState } from "../sdk/GameSDK";
const idle: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  action: false,
  cancel: false,
  pause: false,
  keys: {},
};
function clearGate(journey: SpaceJourney, miss = false) {
  const gate = journey.currentGate;
  const rotation = new THREE.Quaternion().fromArray(gate.rotation);
  const before = new THREE.Vector3(miss ? 90 : 0, 0, -1)
    .applyQuaternion(rotation)
    .add(new THREE.Vector3(...gate.position));
  journey.setState({
    ...journey.getState(),
    position: before.toArray(),
    rotation: gate.rotation,
    speed: 120,
    invulnerable: 3,
  });
  expect(journey.update(16, idle)).toBe(true);
}
describe("endless space journey", () => {
  it("continues past twelve gates, completes races, and earns real upgrades", () => {
    const journey = new SpaceJourney(123);
    const speed = journey.maxSpeed;
    for (let i = 0; i < 25; i++) clearGate(journey);
    expect(journey.gatesPassed).toBe(25);
    expect(journey.races).toBe(5);
    expect(journey.combo).toBe(25);
    expect(journey.level).toBeGreaterThanOrEqual(5);
    expect(journey.maxSpeed).toBeGreaterThan(speed);
    journey.switchShip();
    expect(journey.ship).toBe("twin");
    journey.switchShip();
    expect(journey.ship).toBe("crescent");
    expect(journey.getState().mode).toBe("endless");
  });
  it("a missed ring resets the chain and never stops the journey", () => {
    const journey = new SpaceJourney(123);
    clearGate(journey);
    const xp = journey.xp;
    clearGate(journey, true);
    expect(journey.gatesMissed).toBe(1);
    expect(journey.combo).toBe(0);
    expect(journey.xp).toBe(xp);
    expect(journey.gateIndex).toBe(2);
  });
  it("permits free exploration and rewards a discovered sector only once", () => {
    const journey = new SpaceJourney(123);
    const initial = journey.position.clone();
    const state = journey.getState();
    journey.setState({ ...state, position: [2400, 0, 0], invulnerable: 3 });
    journey.update(16, idle);
    expect(journey.visited.size).toBe(2);
    expect(journey.xp).toBe(200);
    journey.setState({ ...journey.getState(), position: initial.toArray() });
    journey.update(16, idle);
    expect(journey.xp).toBe(200);
    expect(journey.sectors).toHaveLength(27);
    expect(journey.gatesMissed).toBe(0);
  });
  it("recovers from swept asteroid collisions while retaining progression", () => {
    const journey = new SpaceJourney(123);
    const rock = journey.sectors.flatMap((sector) => sector.asteroids)[0];
    journey.setState({
      ...journey.getState(),
      xp: 1600,
      score: 500,
      position: [
        rock.position[0],
        rock.position[1],
        rock.position[2] - rock.radius - 5,
      ],
      speed: 1000,
    });
    const xp = journey.xp;
    expect(journey.update(100, { ...idle, action: true })).toBe(true);
    expect(journey.collisions).toBe(1);
    expect(journey.shield).toBe(50);
    expect(journey.xp).toBeGreaterThanOrEqual(xp);
    expect(journey.score).toBeGreaterThanOrEqual(500);
    expect(journey.controller.speed).toBeLessThan(600);
    expect(
      journey.position.distanceTo(new THREE.Vector3(...rock.position)),
    ).toBeGreaterThan(rock.radius);
    for (let i = 0; i < 10; i++) journey.update(16, idle);
    expect(journey.collisions).toBe(1);
  });
  it("rewards close asteroid passes without collision or repeated frame bonuses", () => {
    const journey = new SpaceJourney(123);
    const rock = journey.sectors.flatMap((sector) => sector.asteroids)[0];
    journey.setState({
      ...journey.getState(),
      energy: 30,
      position: [
        rock.position[0] + rock.radius + 12,
        rock.position[1],
        rock.position[2] - 2,
      ],
      speed: 120,
    });
    journey.update(16, idle);
    expect(journey.collisions).toBe(0);
    expect(journey.nearMisses).toBe(1);
    expect(journey.xp).toBeGreaterThanOrEqual(60);
    expect(journey.energy).toBeGreaterThan(40);
    for (let i = 0; i < 20; i++) journey.update(16, idle);
    expect(journey.nearMisses).toBe(1);
  });
  it("boost drains, requires release after depletion, and recharges", () => {
    const journey = new SpaceJourney(123);
    journey.setState({ ...journey.getState(), energy: 1, invulnerable: 3 });
    journey.update(100, { ...idle, action: true });
    expect(journey.energy).toBe(0);
    expect(journey.boostLocked).toBe(true);
    journey.update(100, { ...idle, action: true });
    expect(journey.boosting).toBe(false);
    expect(journey.energy).toBeGreaterThan(0);
    journey.update(16, idle);
    journey.update(16, { ...idle, action: true });
    expect(journey.boosting).toBe(true);
  });
  it("a full save restores the same universe, upgrades, ship and future simulation", () => {
    const original = new SpaceJourney(123),
      restored = new SpaceJourney(999);
    for (let i = 0; i < 12; i++) clearGate(original);
    original.update(16, { ...idle, keys: { KeyV: true, KeyM: true } });
    const saved = original.getState();
    restored.setState(saved);
    expect(restored.getState()).toEqual(saved);
    for (let i = 0; i < 300; i++) {
      const input: InputState = {
        ...idle,
        left: i % 60 > 30,
        action: i % 40 > 20,
        keys: i < 5 ? { KeyV: true, KeyM: true } : {},
      };
      original.update(16, input);
      restored.update(16, input);
      expect(restored.getState()).toEqual(original.getState());
    }
    expect(saved).not.toEqual(original.getState());
  });
  it("validates snapshots before mutating and rejects locked or corrupt ships", () => {
    const journey = new SpaceJourney(123),
      saved = journey.getState();
    for (const change of [
      { ship: "crescent" },
      { position: [NaN, 0, 0] },
      { rotation: [0, 0, 0, 0] },
      { gates: [] },
      { racePassed: 5 },
      { visited: ["bad"] },
    ]) {
      expect(() => journey.setState({ ...saved, ...change })).toThrow();
      expect(journey.getState()).toEqual(saved);
    }
  });
  it("migrates completed legacy flights into an ongoing journey", async () => {
    const envelope = await validateSave(
      {
        format: 2,
        game: "stellar-flight",
        mode: "course",
        rules_version: 2,
        difficulty: "normal",
        state: {
          version: 1,
          mode: "course",
          courseFinished: true,
          elapsed: 120,
          position: [0, 300, 0],
          rotation: [0, 0, 0, 1],
          speed: 100,
          bestSpeed: 340,
          maxAltitude: 400,
          map: 1,
          gatesPassed: 12,
          gatesMissed: 0,
        },
      },
      "stellar-flight",
    );
    expect(envelope.mode).toBe("endless");
    expect(envelope.rules_version).toBe(5);
    const journey = new SpaceJourney(123);
    journey.setState(envelope.state);
    expect(journey.gatesPassed).toBe(12);
    expect(journey.bestSpeed).toBe(340);
    expect(journey.maxAltitude).toBe(400);
    expect(journey.getState().version).toBe(2);
    expect(journey.update(16, idle)).toBe(true);
  });
  it("keeps moving and streams a bounded world through extended exploration", () => {
    const journey = new SpaceJourney(42);
    for (let i = 0; i < 18000; i++)
      expect(
        journey.update(16, {
          ...idle,
          action: i % 500 < 200,
          left: i % 600 < 20,
          up: i % 800 < 15,
        }),
      ).toBe(true);
    expect(journey.distance).toBeGreaterThan(30000);
    expect(journey.sectors).toHaveLength(27);
    expect(journey.visited.size).toBeGreaterThan(5);
    expect(() => new SpaceJourney().setState(journey.getState())).not.toThrow();
  });
});
it("sector generation is stable across revisits, negative coordinates and save seeds", () => {
  const sector = createSector([-8, 2, 10000], 123);
  expect(createSector([-8, 2, 10000], 123)).toEqual(sector);
  expect(createSector([-8, 2, 10000], 999)).not.toEqual(sector);
  expect(nearbySectors([1e10, -1e10, 0], 123)).toHaveLength(27);
  expect(
    intersectsBody([0, 0, -100], [0, 0, 100], {
      position: [0, 0, 0],
      radius: 20,
    }),
  ).toBe(true);
});
it("reuses only overlapping sectors and discards the previous seed's world", () => {
  const stream = new SectorStream();
  const first = stream.nearby([0, 0, 0], 123);
  const shifted = stream.nearby([2400, 0, 0], 123);
  expect(shifted).toEqual(nearbySectors([2400, 0, 0], 123));
  expect(shifted.filter((sector) => first.includes(sector))).toHaveLength(18);
  const restored = stream.nearby([0, 0, 0], 123);
  expect(restored).toEqual(first);
  const differentSeed = stream.nearby([0, 0, 0], 999);
  expect(differentSeed).toEqual(nearbySectors([0, 0, 0], 999));
  expect(differentSeed.some((sector) => restored.includes(sector))).toBe(false);
  expect(stream.nearby([1e10, -1e10, 0], 999)).toHaveLength(27);
});
it("the new ships have distinct actual hull geometry and two exhausts each", () => {
  const signatures = new Set<string>();
  for (const id of ["dart", "twin", "crescent"] as const) {
    const ship = createShip(id);
    const box = new THREE.Box3().setFromObject(ship);
    signatures.add(box.getSize(new THREE.Vector3()).toArray().join(":"));
    expect(
      ship.children.filter((child) => child.name === "exhaust"),
    ).toHaveLength(2);
    expect(ship.children.length).toBeGreaterThan(8);
  }
  expect(signatures.size).toBe(3);
  expect(levelForXP(1600)).toBe(3);
  expect(levelForXP(6400)).toBe(5);
});

it("contracts reward completed play once and retain their objective baseline in a save", () => {
  const journey = new SpaceJourney(123);
  for (let i = 0; i < 4; i++) clearGate(journey);
  const before = journey.xp;
  clearGate(journey);
  expect(journey.contractIndex).toBe(1);
  expect(journey.xp - before).toBeGreaterThanOrEqual(1800);
  expect(journey.lastRace).toMatchObject({ passed: 5, medal: "gold" });
  expect(journey.bestRace).toBeGreaterThan(0);
  const restored = new SpaceJourney(999);
  restored.setState(journey.getState());
  const xp = restored.xp;
  restored.update(16, idle);
  expect(restored.contractIndex).toBe(1);
  expect(restored.xp).toBe(xp);
});
it("surveys refuel the ship once per sector and point to the next unscanned beacon", () => {
  const journey = new SpaceJourney(123);
  const beacon = [...journey.currentSector.beacon];
  journey.setState({
    ...journey.getState(),
    navigation: "explore",
    position: beacon,
    energy: 10,
    shield: 20,
  });
  journey.update(16, idle);
  expect(journey.scanned.size).toBe(1);
  expect(journey.energy).toBe(100);
  expect(journey.shield).toBe(100);
  expect(journey.xp).toBe(350);
  expect(journey.target).not.toEqual(beacon);
  journey.update(16, idle);
  expect(journey.xp).toBe(350);
  const restored = new SpaceJourney(999);
  restored.setState(journey.getState());
  expect(restored.getState()).toEqual(journey.getState());
});
it("new camera and navigation buttons are edge-triggered and saved", () => {
  const journey = new SpaceJourney(123);
  journey.update(16, { ...idle, keys: { KeyC: true, KeyN: true } });
  journey.update(16, { ...idle, keys: { KeyC: true, KeyN: true } });
  expect(journey.cameraView).toBe("nose");
  expect(journey.navigation).toBe("explore");
  const restored = new SpaceJourney();
  restored.setState(journey.getState());
  restored.update(16, { ...idle, keys: { KeyC: true, KeyN: true } });
  expect(restored.cameraView).toBe("nose");
  expect(restored.navigation).toBe("explore");
  restored.update(16, idle);
  restored.update(16, { ...idle, keys: { KeyC: true } });
  expect(restored.cameraView).toBe("wide");
});
it("earlier endless saves retain their progress and default new systems", async () => {
  const journey = new SpaceJourney(123);
  clearGate(journey);
  const old = journey.getState();
  for (const field of [
    "raceTime",
    "racePar",
    "bestRace",
    "bestPace",
    "raceLength",
    "lastRace",
    "contractIndex",
    "contractBaseline",
    "scanned",
    "navigation",
    "navigationHeld",
    "cameraView",
    "cameraHeld",
    "pitchVelocity",
    "yawVelocity",
  ])
    delete old[field];
  const envelope = await validateSave(
    {
      format: 2,
      game: "stellar-flight",
      rules_version: 3,
      mode: "endless",
      difficulty: "normal",
      state: old,
    },
    "stellar-flight",
  );
  expect(envelope.rules_version).toBe(5);
  const restored = new SpaceJourney(999);
  restored.setState(envelope.state);
  expect(restored.gatesPassed).toBe(1);
  expect(restored.cameraView).toBe("chase");
  expect(restored.contractIndex).toBe(0);
  expect(restored.xp).toBe(journey.xp);
});
it("twenty minutes of analog racing stays endless, streams a bounded world, and restores mid-turn", () => {
  const journey = new SpaceJourney(2026);
  const local = new THREE.Vector3(),
    inverse = new THREE.Quaternion();
  for (let i = 0; i < 75000; i++) {
    local
      .fromArray(journey.target)
      .sub(journey.position)
      .applyQuaternion(inverse.copy(journey.rotation).invert());
    const x = -Math.max(-1, Math.min(1, Math.atan2(local.x, local.z) * 4));
    const y = -Math.max(
      -1,
      Math.min(1, Math.atan2(local.y, Math.hypot(local.x, local.z)) * 4),
    );
    const playing = journey.update(16, {
      ...idle,
      axes: { x, y },
      action: i % 600 < 260,
      keys: local.z < -500 ? { KeyM: true } : {},
    });
    if (!playing) throw new Error("An endless journey stopped");
  }
  expect(journey.elapsed).toBeGreaterThan(1199);
  expect(journey.distance).toBeGreaterThan(100000);
  expect(journey.gatesPassed).toBeGreaterThan(20);
  expect(journey.contractIndex).toBeGreaterThan(1);
  expect(journey.sectors).toHaveLength(27);
  const restored = new SpaceJourney(999);
  restored.setState(journey.getState());
  for (let i = 0; i < 300; i++) {
    const input: InputState = {
      ...idle,
      axes: { x: -0.4, y: 0.2 },
      action: i < 100,
    };
    journey.update(16, input);
    restored.update(16, input);
    expect(restored.getState()).toEqual(journey.getState());
  }
}, 15000);

it("fresh keyboard taps work immediately after restoring a held camera or navigation button", () => {
  const journey = new SpaceJourney(123);
  journey.update(16, { ...idle, keys: { KeyC: true, KeyN: true } });
  const restored = new SpaceJourney(999);
  restored.setState(journey.getState());
  restored.update(16, {
    ...idle,
    keys: { KeyC: true, KeyN: true },
    pressed: ["KeyC", "KeyN"],
  });
  expect(restored.cameraView).toBe("wide");
  expect(restored.navigation).toBe("race");
});
