import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { FlightHUD } from "../games/stellar-flight/FlightHUD";
import { SpaceJourney } from "../games/stellar-flight/SpaceJourney";

it("navigation hints and radar use the same left/right direction as the chase camera", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const parent = document.createElement("div"),
    canvas = document.createElement("canvas");
  Object.defineProperties(canvas, {
    clientWidth: { value: 960 },
    clientHeight: { value: 640 },
  });
  parent.appendChild(canvas);
  document.body.appendChild(parent);
  const hud = new FlightHUD(canvas),
    journey = new SpaceJourney(123);
  const camera = new THREE.PerspectiveCamera(70, 1.5, 0.1, 18000);
  camera.position.set(0, 5.5, -22);
  camera.lookAt(0, 0.5, 38);
  camera.updateMatrixWorld();
  journey.gates[0].position = [-200, 0, 500];
  hud.update(journey, camera, 0.1);
  expect(parent.querySelector(".space-race-detail")?.textContent).toContain(
    "STEER RIGHT",
  );
  expect(
    parseFloat(
      (parent.querySelector(".space-target") as HTMLElement).style.left,
    ),
  ).toBeGreaterThan(480);
  journey.gates[0].position = [200, 0, 500];
  hud.update(journey, camera, 0.1);
  expect(parent.querySelector(".space-race-detail")?.textContent).toContain(
    "STEER LEFT",
  );
  expect(
    parseFloat(
      (parent.querySelector(".space-target") as HTMLElement).style.left,
    ),
  ).toBeLessThan(480);
  journey.gates[0].position = [0, 0, -500];
  hud.update(journey, camera, 0.1);
  expect(
    parent.querySelector(".space-target")?.getAttribute("data-offscreen"),
  ).toBe("true");
  hud.destroy();
  expect(parent.querySelector(".space-target")).toBeNull();
  parent.remove();
});

it("reads HUD layout before text changes and reuses instrument elements", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const parent = document.createElement("div"),
    canvas = document.createElement("canvas"),
    operations: string[] = [];
  for (const [key, value] of Object.entries({
    offsetLeft: 10,
    offsetTop: 20,
    clientWidth: 960,
    clientHeight: 640,
  }))
    Object.defineProperty(canvas, key, {
      get: () => {
        operations.push("read");
        return value;
      },
    });
  parent.append(canvas);
  const hud = new FlightHUD(canvas),
    journey = new SpaceJourney(123),
    camera = new THREE.PerspectiveCamera(70, 1.5, 0.1, 18000);
  camera.updateMatrixWorld();
  const setter = Object.getOwnPropertyDescriptor(
    Node.prototype,
    "textContent",
  )!.set!;
  vi.spyOn(Node.prototype, "textContent", "set").mockImplementation(function (
    this: Node,
    value,
  ) {
    operations.push("write");
    setter.call(this, value);
  });
  const query = vi.spyOn(hud.root, "querySelector");
  hud.update(journey, camera, 0);
  expect(operations.indexOf("write")).toBeGreaterThan(
    operations.lastIndexOf("read"),
  );
  expect(query).toHaveBeenCalled();
  query.mockClear();
  hud.update(journey, camera, 0);
  expect(query).not.toHaveBeenCalled();
  hud.destroy();
});
