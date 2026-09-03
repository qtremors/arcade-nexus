import * as THREE from "three";

export function disposeFlightObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  object.traverse((child) => {
    if (child instanceof THREE.Sprite) {
      geometries.add(child.geometry);
      materials.add(child.material);
    } else if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.Points ||
      child instanceof THREE.LineSegments
    ) {
      geometries.add(child.geometry);
      for (const material of Array.isArray(child.material)
        ? child.material
        : [child.material])
        materials.add(material);
      if (child instanceof THREE.InstancedMesh) child.dispose();
    }
  });
  for (const material of materials) {
    for (const value of Object.values(material))
      if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
}
