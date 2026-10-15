import * as THREE from "three";
import { SHIPS } from "./ships";
import { contracts, type JourneyCounters, type contractFor } from "./contracts";
import type { Sector } from "./universe";
export interface JourneyEffects {
  notify(message: string): void;
  reward(xp: number, points: number): void;
}
interface RewardState {
  xp: number;
  score: number;
  readonly level: number;
}
export function applyReward(
  state: RewardState,
  xp: number,
  points: number,
  notify: (message: string) => void,
) {
  const before = state.level;
  state.xp += xp;
  state.score = Math.min(2147483647, state.score + Math.floor(points));
  if (state.level > before) {
    const unlock = SHIPS.filter(
      (ship) => ship.level > before && ship.level <= state.level,
    ).map((ship) => ship.name);
    notify(
      `LEVEL ${state.level} · Engine + handling upgraded${unlock.length ? ` · ${unlock.join(" / ")} unlocked · V / X to switch` : ""}`,
    );
  }
}
interface ObjectiveState {
  readonly currentSector: Sector;
  visited: Set<string>;
  scanned: Set<string>;
  position: THREE.Vector3;
  navigation: "race" | "explore";
  energy: number;
  shield: number;
  event: "collect" | "miss" | "hit" | null;
}
export function discoverSector(state: ObjectiveState, effects: JourneyEffects) {
  if (!state.visited.has(state.currentSector.key)) {
    state.visited.add(state.currentSector.key);
    effects.notify(`DISCOVERED ${state.currentSector.name} · +200 XP`);
    effects.reward(200, 300);
  }
}
export function surveySector(state: ObjectiveState, effects: JourneyEffects) {
  if (
    state.navigation === "explore" &&
    !state.scanned.has(state.currentSector.key) &&
    state.position.distanceTo(
      new THREE.Vector3(...state.currentSector.beacon),
    ) < 100
  ) {
    state.scanned.add(state.currentSector.key);
    state.energy = 100;
    state.shield = 100;
    effects.notify("SECTOR SURVEYED · +350 XP · Boost + shields replenished");
    effects.reward(350, 800);
    state.event = "collect";
  }
}
interface ContractState {
  readonly contract: ReturnType<typeof contractFor>;
  readonly counters: JourneyCounters;
  contractIndex: number;
  contractChoice: number;
  contractBaseline: JourneyCounters;
  event: "collect" | "miss" | "hit" | null;
}
export function advanceContract(state: ContractState, effects: JourneyEffects) {
  const contract = state.contract;
  if (contract.progress >= contract.target) {
    state.contractIndex++;
    state.contractChoice = (state.contractChoice + 1) % contracts.length;
    state.contractBaseline = state.counters;
    effects.notify(
      `CONTRACT COMPLETE · ${contract.title} · +${contract.reward} XP`,
    );
    effects.reward(contract.reward, contract.reward * 2);
    state.event = "collect";
  }
}
