import * as THREE from "three";
import { intersectsBody, type Coordinates, type SpaceBody } from "./universe";
import type { FlightMotionState } from "./flightMotion";
import type { JourneyEffects } from "./progressionPolicy";
interface CollisionState extends FlightMotionState {
  collisions: number;
  combo: number;
  nearMisses: number;
  nearMissCooldown: number;
  event: "hit" | "miss" | "collect" | null;
}
export function advanceCollisions(
  state: CollisionState,
  frame: { previous: THREE.Vector3; forward: THREE.Vector3 },
  collisionBodies: SpaceBody[],
  effects: JourneyEffects & { refreshSectors(): void },
) {
  const before = frame.previous.toArray() as Coordinates,
    after = state.position.toArray() as Coordinates;
  if (state.invulnerable === 0) {
    let closePass = false;
    const body = collisionBodies.find((body) => {
      if (intersectsBody(before, after, body)) return true;
      if (body.radius < 100 && intersectsBody(before, after, body, 30))
        closePass = true;
      return false;
    });
    if (body) {
      state.collisions++;
      const absorbed = state.shield >= 40;
      state.shield = Math.max(0, state.shield - state.specification.impactCost);
      state.energy = Math.max(0, state.energy - (absorbed ? 15 : 30));
      state.controller.speed = Math.max(
        35,
        state.controller.speed * (absorbed ? 0.78 : 0.5),
      );
      state.combo = 0;
      state.invulnerable = 3;
      state.pitchVelocity = 0;
      state.yawVelocity = 0;
      const escape = state.position
        .clone()
        .sub(new THREE.Vector3(...body.position));
      if (escape.lengthSq() < 0.001) escape.copy(frame.forward).negate();
      state.position.copy(
        new THREE.Vector3(...body.position).add(
          escape.setLength(body.radius + 12),
        ),
      );
      frame.previous.copy(state.position);
      effects.refreshSectors();
      effects.notify(
        absorbed
          ? "SHIELD ABSORBED IMPACT · Keep flying"
          : "HULL RECOVERED · Progress kept · Shield recharging",
      );
      state.event = "hit";
    } else if (closePass && state.nearMissCooldown === 0) {
      state.nearMisses++;
      state.nearMissCooldown = 2;
      state.energy = Math.min(100, state.energy + 10);
      effects.notify("CLOSE PASS · +60 XP · Boost recovered");
      effects.reward(60, 200);
      state.event = "collect";
    }
  }
}
