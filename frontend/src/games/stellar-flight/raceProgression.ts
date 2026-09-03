import * as THREE from "three";
import type { z } from "zod";
import type { gateSchema, raceResultSchema } from "./codec";
import { crossGate } from "./course";
import { evaluateRace } from "./racePolicy";
import type { JourneyEffects } from "./progressionPolicy";
interface RaceState {
  readonly currentGate: z.infer<typeof gateSchema>;
  position: THREE.Vector3;
  navigation: "race" | "explore";
  gatesPassed: number;
  gatesMissed: number;
  racePassed: number;
  combo: number;
  bestCombo: number;
  energy: number;
  event: "collect" | "miss" | "hit" | null;
  gateIndex: number;
  gates: z.infer<typeof gateSchema>[];
  races: number;
  raceTime: number;
  racePar: number;
  raceLength: number;
  bestPace: number | null;
  bestRace: number | null;
  lastRace: z.infer<typeof raceResultSchema> | null;
}
export class RaceProgression {
  private gateRotation = new THREE.Quaternion();
  private normal = new THREE.Vector3();
  advance(
    state: RaceState,
    previous: THREE.Vector3,
    effects: JourneyEffects & { newRoute(): void },
  ) {
    const gate = state.currentGate;
    this.gateRotation.fromArray(gate.rotation);
    this.normal.set(0, 0, 1).applyQuaternion(this.gateRotation);
    const crossing = crossGate(
      previous.toArray(),
      state.position.toArray(),
      gate.position,
      this.normal.toArray(),
      68,
    );
    // Flying elsewhere in the open world must not count as an unlimited plane miss.
    if (
      state.navigation === "race" &&
      crossing &&
      state.position.distanceTo(new THREE.Vector3(...gate.position)) < 500
    ) {
      if (crossing === "pass") {
        const local = state.position
          .clone()
          .sub(new THREE.Vector3(...gate.position));
        const offset = local
          .addScaledVector(this.normal, -local.dot(this.normal))
          .length();
        const precision = offset < 22;
        state.gatesPassed++;
        state.racePassed++;
        state.combo++;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.energy = Math.min(100, state.energy + 25);
        effects.notify(
          `GATE CLEARED${precision ? " · PERFECT CENTER" : ""} · Chain ×${state.combo} · +${100 + Math.min(10, state.combo) * 20} XP`,
        );
        effects.reward(
          100 + Math.min(10, state.combo) * 20,
          500 + Math.min(10, state.combo) * 100 + (precision ? 150 : 0),
        );
        state.event = "collect";
      } else {
        state.gatesMissed++;
        state.combo = 0;
        effects.notify("GATE MISSED · Keep flying, another ring ahead");
        state.event = "miss";
      }
      state.gateIndex++;
      if (state.gateIndex === state.gates.length) {
        state.races++;
        const { clean, medal, points, pace } = evaluateRace(
          state.racePassed,
          state.raceTime,
          state.racePar,
          state.raceLength,
        );
        if (clean)
          state.bestPace =
            state.bestPace === null ? pace : Math.min(state.bestPace, pace);
        state.lastRace = {
          pace,
          time: state.raceTime,
          passed: state.racePassed,
          medal,
          points,
        };
        if (clean)
          state.bestRace =
            state.bestRace === null
              ? state.raceTime
              : Math.min(state.bestRace, state.raceTime);
        effects.notify(
          `RACE ${state.races} COMPLETE · ${medal.toUpperCase()} · ${state.raceTime.toFixed(1)}s · Next race ahead`,
        );
        effects.reward(clean ? 1000 : 400, points);
        effects.newRoute();
      }
    }
  }
}
