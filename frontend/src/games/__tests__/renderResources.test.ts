import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { AsteroidField } from "../stellar-flight/AsteroidField";
import { CanvasLayer } from "../../sdk/CanvasLayer";

it("culls only offscreen asteroids, retaining edge intersections and restoring rocks after turns", () => {
  const geometry = new THREE.IcosahedronGeometry(1, 1),
    material = new THREE.MeshLambertMaterial(),
    camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000),
    field = new AsteroidField(geometry, material, 4);
  const edge = (20 * Math.tan(Math.PI / 6) * 16) / 9;
  const rocks = [
    [0, 0, -20],
    [0, 0, 20],
    [1000, 0, -20],
    [edge + 1, 0, -20],
  ].map(([x, y, z], i) => ({
    matrix: new THREE.Matrix4().makeTranslation(x, y, z),
    sphere: new THREE.Sphere(new THREE.Vector3(x, y, z), 2),
    color: new THREE.Color(i % 2 ? "red" : "blue"),
  }));
  field.setRocks(rocks);
  camera.updateMatrixWorld();
  field.updateView(camera);
  expect(field.count).toBe(2);
  const matrix = new THREE.Matrix4(),
    color = new THREE.Color();
  field.getMatrixAt(1, matrix);
  field.getColorAt(1, color);
  matrix.elements.forEach((value, i) =>
    expect(value).toBeCloseTo(rocks[3].matrix.elements[i], 5),
  );
  expect(color).toEqual(rocks[3].color);
  // Moving the floating render origin must not change culling.
  field.position.set(100000, 200000, 300000);
  camera.position.copy(field.position);
  camera.updateMatrixWorld();
  field.updateView(camera);
  expect(field.count).toBe(2);
  camera.lookAt(100000, 200000, 300001);
  camera.updateMatrixWorld();
  field.updateView(camera);
  expect(field.count).toBe(1);
  field.getMatrixAt(0, matrix);
  expect(matrix).toEqual(rocks[1].matrix);
  expect(rocks).toHaveLength(4);
  field.dispose();
  geometry.dispose();
  material.dispose();
});

it("caches artwork at Full HD, invalidates changed content/buffers, and releases its storage", () => {
  const source = { setTransform: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    source as unknown as CanvasRenderingContext2D,
  );
  const target = {
    canvas: { width: 1620, height: 1080 },
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  const layer = new CanvasLayer(),
    paint = vi.fn();
  layer.draw(target, 960, 640, "bricks-1", paint);
  layer.draw(target, 960, 640, "bricks-1", paint);
  expect(paint).toHaveBeenCalledTimes(1);
  expect(source.setTransform).toHaveBeenLastCalledWith(
    1.6875,
    0,
    0,
    1.6875,
    0,
    0,
  );
  const buffer = vi.mocked(target.drawImage).mock
    .calls[0][0] as HTMLCanvasElement;
  expect([buffer.width, buffer.height]).toEqual([1620, 1080]);
  layer.draw(target, 960, 640, "bricks-2", paint);
  expect(paint).toHaveBeenCalledTimes(2);
  target.canvas.width = 1920;
  layer.draw(target, 960, 640, "bricks-2", paint);
  expect(paint).toHaveBeenCalledTimes(3);
  layer.destroy();
  expect([buffer.width, buffer.height]).toEqual([0, 0]);
});

it("does not upload unchanged asteroid buffers as the camera moves, and invalidates restored data", () => {
  const geometry = new THREE.IcosahedronGeometry(1),
    material = new THREE.MeshBasicMaterial(),
    field = new AsteroidField(geometry, material, 3),
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  const rocks = [0, 1, 2].map((x) => ({
    matrix: new THREE.Matrix4().makeTranslation(x, 0, -100),
    sphere: new THREE.Sphere(new THREE.Vector3(x, 0, -100), 1),
    color: new THREE.Color("red"),
  }));
  field.setRocks(rocks);
  camera.updateMatrixWorld();
  field.updateView(camera);
  const matrixVersion = field.instanceMatrix.version,
    colorVersion = field.instanceColor!.version;
  field.instanceMatrix.clearUpdateRanges();
  field.instanceColor!.clearUpdateRanges();
  for (let i = 0; i < 120; i++) {
    camera.position.x = i * 0.001;
    camera.updateMatrixWorld();
    field.updateView(camera);
  }
  expect(field.instanceMatrix.version).toBe(matrixVersion);
  expect(field.instanceColor!.version).toBe(colorVersion);
  expect(field.count).toBe(3);
  field.setRocks([rocks[0], rocks[2]]);
  field.updateView(camera);
  expect(field.count).toBe(2);
  expect(field.instanceMatrix.version).toBeGreaterThan(matrixVersion);
  expect(field.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 32 }]);
  const matrix = new THREE.Matrix4();
  field.getMatrixAt(1, matrix);
  expect(matrix).toEqual(rocks[2].matrix);
  camera.lookAt(0, 0, 100);
  camera.updateMatrixWorld();
  field.updateView(camera);
  expect(field.count).toBe(0);
  camera.lookAt(0, 0, -100);
  camera.updateMatrixWorld();
  field.updateView(camera);
  expect(field.count).toBe(2);
  field.dispose();
  geometry.dispose();
  material.dispose();
});
