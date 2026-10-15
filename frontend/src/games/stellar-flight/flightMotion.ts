import * as THREE from "three";
import type { InputState } from "../../sdk/GameSDK";
import type { FlightController } from "./FlightController";
import type { SHIPS } from "./ships";
export interface FlightMotionState {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  controller: FlightController;
  readonly level: number;
  readonly maxSpeed: number;
  readonly specification: (typeof SHIPS)[number];
  energy: number;
  shield: number;
  invulnerable: number;
  boosting: boolean;
  boostLocked: boolean;
  pitchVelocity: number;
  yawVelocity: number;
}
/** Steering and energy use reusable scratch geometry, independent of route/reward policy. */
export class FlightMotion {
  readonly previous = new THREE.Vector3();
  readonly forward = new THREE.Vector3();
  private turn = new THREE.Quaternion();
  private yawAxis = new THREE.Vector3(0, 1, 0);
  private pitchAxis = new THREE.Vector3(1, 0, 0);
  advance(state: FlightMotionState, dt: number, input: InputState) {
    const requestedBoost = !!(
      input.action ||
      input.keys.ShiftLeft ||
      input.keys.ShiftRight ||
      (input.throttle ?? 0) > 0
    );
    if (!requestedBoost) state.boostLocked = false;
    state.boosting = requestedBoost && !state.boostLocked && state.energy > 0;
    state.energy = Math.max(
      0,
      Math.min(
        100,
        state.energy +
          dt *
            (state.boosting
              ? -state.specification.boostDrain
              : state.specification.recharge + Math.min(20, state.level) * 0.3),
      ),
    );
    if (state.boosting && state.energy === 0) state.boostLocked = true;
    state.shield = Math.min(
      100,
      state.shield +
        (state.invulnerable > 0 ? 0 : dt * state.specification.shieldRegen),
    );
    const braking = !!(
      input.keys.ControlLeft ||
      input.keys.ControlRight ||
      (input.throttle ?? 0) < 0
    );
    const cruise =
      (140 + Math.log2(state.level) * 18) * state.specification.speed;
    state.controller.minSpeed = 35;
    state.controller.maxSpeed = state.maxSpeed;
    state.controller.acceleration =
      state.specification.acceleration + Math.min(20, state.level) * 3;
    state.controller.deceleration = 160;
    state.controller.update(dt, {
      ...input,
      action: false,
      throttle: state.boosting ? 1 : braking ? -1 : 0,
      keys: {
        ...input.keys,
        ShiftLeft: state.boosting,
        ShiftRight: false,
        ControlLeft: braking,
        ControlRight: false,
      },
    });
    if (!state.boosting && !braking)
      state.controller.speed +=
        (cruise - state.controller.speed) * Math.min(1, dt * 0.7);
    const handling =
      state.specification.handling * (1 + Math.log2(state.level) * 0.035);
    const response = 1 - Math.exp(-dt * 10);
    const authority = state.boosting ? 0.86 : 1;
    state.pitchVelocity +=
      (state.controller.inputPitch * 0.8 * handling * authority -
        state.pitchVelocity) *
      response;
    state.yawVelocity +=
      (Math.max(
        -1.25,
        Math.min(
          1.25,
          state.controller.inputYaw + state.controller.inputRoll * 1.25,
        ),
      ) *
        0.7 *
        handling *
        authority -
        state.yawVelocity) *
      response;
    // Smooth steering preserves direct control without abrupt camera motion.
    this.turn.setFromAxisAngle(this.pitchAxis, state.pitchVelocity * dt);
    state.rotation.multiply(this.turn);
    this.turn.setFromAxisAngle(this.yawAxis, state.yawVelocity * dt);
    state.rotation.multiply(this.turn).normalize();
    this.previous.copy(state.position);
    this.forward.set(0, 0, 1).applyQuaternion(state.rotation);
    const travel = state.controller.speed * dt;
    state.position.addScaledVector(this.forward, travel);
    return travel;
  }
}
