import * as THREE from "three";
import { SECTOR_SIZE, type Sector } from "./universe";

export function createSectorGroup(sector: Sector, seed: number): THREE.Group {
  const group = new THREE.Group();
  group.userData.seed = seed;
  group.userData.center = new THREE.Vector3(
    ...sector.coordinates,
  ).multiplyScalar(SECTOR_SIZE);
  const center = group.userData.center as THREE.Vector3;
  if (sector.planet) {
    const radius = sector.planet.radius;
    const geometry = new THREE.SphereGeometry(radius, 24, 16);
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3),
      color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i) / radius,
        x = positions.getX(i) / radius,
        z = positions.getZ(i) / radius;
      const noise = Math.sin(x * 17 + z * 9) * Math.cos(y * 19 - x * 7);
      if (sector.planetStyle === "gas")
        color.setHSL(
          0.08 + Math.sin(y * 30) * 0.025,
          0.38,
          0.31 + Math.sin(y * 35) * 0.09,
        );
      else if (sector.planetStyle === "ice")
        color.setHSL(0.54, 0.2, 0.38 + Math.abs(y) * 0.25 + noise * 0.05);
      else
        color.setHSL(
          noise > 0.12 ? 0.3 : 0.59,
          noise > 0.12 ? 0.3 : 0.4,
          0.2 + Math.abs(y) * 0.12 + noise * 0.04,
        );
      colors.set([color.r, color.g, color.b], i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const planet = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
    planet.position.set(...sector.planet.position).sub(center);
    if (sector.planetStyle === "gas") {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius * 1.35, radius * 1.9, 48),
        new THREE.MeshBasicMaterial({
          color: 0xb9a98c,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        }),
      );
      ring.rotation.set(1.1, 0.3, 0.2);
      planet.add(ring);
    }
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.035, 20, 12),
      new THREE.MeshBasicMaterial({
        color: sector.planetStyle === "gas" ? 0xe9b58b : 0x65c9ff,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    planet.add(atmosphere);
    group.add(planet);
  }
  return group;
}

export function createSurveyMarkers(): THREE.Group {
  const survey = new THREE.Group();
  const beacon = new THREE.Mesh(
    new THREE.TorusGeometry(34, 1.4, 6, 40),
    new THREE.MeshBasicMaterial({ color: 0xb99bff, fog: false }),
  );
  beacon.rotation.x = Math.PI / 2;
  survey.add(beacon);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 160, 6),
    new THREE.MeshBasicMaterial({
      color: 0xb99bff,
      transparent: true,
      opacity: 0.25,
    }),
  );
  survey.add(pillar);
  // Silhouettes distinguish survey destinations even without their HUD labels.
  for (const name of ["Relay spire", "Ring archive", "Crystal garden"]) {
    const landmark = new THREE.Group();
    landmark.name = name;
    const material = new THREE.MeshLambertMaterial({
      color: name === "Crystal garden" ? 0x7de8c4 : 0xb99bff,
      emissive: 0x211a36,
    });
    for (let i = 0; i < (name === "Relay spire" ? 1 : 5); i++) {
      const geometry =
        name === "Relay spire"
          ? new THREE.CylinderGeometry(3, 12, 100, 6)
          : name === "Ring archive"
            ? new THREE.TorusGeometry(40 + i * 8, 2, 6, 32)
            : new THREE.OctahedronGeometry(12 + i * 2);
      const mesh = new THREE.Mesh(geometry, material);
      if (name === "Ring archive") mesh.rotation.set(i * 0.45, i * 0.3, 0);
      else if (name === "Crystal garden")
        mesh.position.set(
          Math.cos(i * 1.256) * 30,
          (i % 2) * 16,
          Math.sin(i * 1.256) * 30,
        );
      else mesh.position.y = 50;
      landmark.add(mesh);
    }
    survey.add(landmark);
  }
  return survey;
}
