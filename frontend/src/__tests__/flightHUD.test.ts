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
