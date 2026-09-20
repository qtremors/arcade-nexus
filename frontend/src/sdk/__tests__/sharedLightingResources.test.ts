import { expect, it, vi } from "vitest";
import {
  BoxGeometry,
  DataTexture,
  Mesh,
  MeshStandardMaterial,
  Scene,
  type WebGLRenderer,
} from "three";
import { SharedLightingResources } from "../SharedLightingResources";

it("preserves shader code/cache identity and releases the shared lighting texture after uniforms are populated", () => {
  const resources = new SharedLightingResources(),
    material = new MeshStandardMaterial(),
    scene = new Scene();
  scene.add(new Mesh(new BoxGeometry(), material));
  const key = material.customProgramCacheKey();
  resources.observe(scene);
  resources.observe(scene);
  const shader = {
    vertexShader: "vertex",
    fragmentShader: "fragment",
    uniforms: { dfgLUT: { value: null as DataTexture | null } },
  } as unknown as Parameters<typeof material.onBeforeCompile>[0];
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  expect(material.customProgramCacheKey()).toBe(key);
  expect([shader.vertexShader, shader.fragmentShader]).toEqual([
    "vertex",
    "fragment",
  ]);
  // Three fills this slot while uploading the first draw, after onBeforeCompile.
  const shared = new DataTexture();
  shared.name = "DFG_LUT";
  shader.uniforms.dfgLUT.value = shared;
  const disposed = vi.fn();
  shared.addEventListener("dispose", disposed);
  resources.dispose();
  resources.dispose();
  expect(disposed).toHaveBeenCalledOnce();
});
