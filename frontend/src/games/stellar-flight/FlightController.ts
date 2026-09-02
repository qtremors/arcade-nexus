import type { InputState } from "../../sdk/GameSDK";

export class FlightController {
  // Current state
  speed: number = 0;
  maxSpeed: number = 450;
  minSpeed: number = 0;
  acceleration: number = 50;
  deceleration: number = 30;

  // Orientation forces (degrees per second)
  pitchSpeed: number = 60;
  rollSpeed: number = 90;
  yawSpeed: number = 30;

  // Current input values (-1 to 1)
  inputPitch: number = 0;
  inputRoll: number = 0;
  inputYaw: number = 0;

  constructor() {}

  update(dt: number, input: InputState) {
    // Throttle
    if (
      input.keys["ShiftLeft"] ||
      input.keys["ShiftRight"] ||
      (input.throttle ?? 0) > 0
    ) {
      this.speed +=
        this.acceleration *
        dt *
        ((input.throttle ?? 0) > 0 ? input.throttle! : 1);
    } else if (
      input.keys["ControlLeft"] ||
      input.keys["ControlRight"] ||
      (input.throttle ?? 0) < 0
    ) {
      this.speed -=
        this.deceleration *
        dt *
        ((input.throttle ?? 0) < 0 ? -input.throttle! : 1);
    }

    // Clamp speed
    this.speed = Math.max(this.minSpeed, Math.min(this.maxSpeed, this.speed));

    // Orientation inputs - use InputState normalized values
    this.inputPitch = 0;
    this.inputRoll = 0;
    this.inputYaw = 0;

    // Pitch: W/S or Up/Down arrows
    if (input.up) this.inputPitch = -1;
    if (input.down) this.inputPitch = 1;

    // Roll: A/D or Left/Right arrows
    if (input.left) this.inputRoll = 1;
    if (input.right) this.inputRoll = -1;
    if (input.axes?.x) this.inputRoll = -input.axes.x;
    if (input.axes?.y) this.inputPitch = input.axes.y;

    // Yaw: Q/E keys
    if (input.keys["KeyQ"]) this.inputYaw = 1;
    if (input.keys["KeyE"]) this.inputYaw = -1;
  }

  getDeltaRotation(dt: number) {
    return {
      x: this.inputPitch * this.pitchSpeed * dt * (Math.PI / 180),
      y: this.inputYaw * this.yawSpeed * dt * (Math.PI / 180),
      z: this.inputRoll * this.rollSpeed * dt * (Math.PI / 180),
    };
  }
  /** Arcade banking steers the heading, with less authority at low speed. */
  getBankTurn(dt: number, bank: number): number {
    return Math.sin(bank) * 0.5 * dt * Math.min(1, this.speed / 80);
  }
}
