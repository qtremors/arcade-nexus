import { Material, Texture, type IUniform, type Object3D } from "three";

/**
 * Three r186's shared DFG texture retains each renderer through dispose listeners.
 * Capture its uniform through the public shader hook, then release it on teardown.
 * No private renderer fields, shader changes or context loss are needed.
 */
export class SharedLightingResources {
  private uniform: IUniform<unknown> | null = null;
  private observed = new WeakSet<Material>();

  observe(root: Object3D): void {
    root.traverse((object) => {
      if (!("material" in object)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        if (!(material instanceof Material) || this.observed.has(material))
          continue;
        this.observed.add(material);
        const compile = material.onBeforeCompile;
        // Keep the original shader cache identity; the hook changes no GLSL.
        if (
          material.customProgramCacheKey ===
          Material.prototype.customProgramCacheKey
        )
          material.customProgramCacheKey = () => compile.toString();
        material.onBeforeCompile = (shader, renderer) => {
          compile.call(material, shader, renderer);
          this.uniform = shader.uniforms.dfgLUT ?? this.uniform;
        };
      }
    });
  }

  dispose(): void {
    const texture = this.uniform?.value;
    if (texture instanceof Texture && texture.name === "DFG_LUT")
      texture.dispose();
    this.uniform = null;
  }
}
