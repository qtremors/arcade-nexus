import * as THREE from "three";

export const SHIPS = [
  {
    id: "jet",
    name: "Legacy Jet",
    level: 1,
    speed: 1,
    handling: 1,
    color: 0x8edbf5,
    role: "Efficient cruise · longer boost, steady turns",
    boostDrain: 12,
    recharge: 15,
    shieldRegen: 12,
    impactCost: 45,
    acceleration: 90,
  },
  {
    id: "dart",
    name: "Nova Dart",
    level: 1,
    speed: 1.06,
    handling: 1.15,
    color: 0x67e8f9,
    role: "Quick launch · precise turns, shorter boost",
    boostDrain: 21,
    recharge: 13,
    shieldRegen: 10,
    impactCost: 50,
    acceleration: 125,
  },
  {
    id: "twin",
    name: "Vanguard",
    level: 3,
    speed: 1.16,
    handling: 0.9,
    color: 0xffc27a,
    role: "Heavy racer · strong shields, wide turns",
    boostDrain: 25,
    recharge: 10,
    shieldRegen: 18,
    impactCost: 30,
    acceleration: 105,
  },
  {
    id: "crescent",
    name: "Star Manta",
    level: 5,
    speed: 1.02,
    handling: 1.3,
    color: 0xc4a0ff,
    role: "Survey specialist · agile, fast recharge",
    boostDrain: 17,
    recharge: 20,
    shieldRegen: 9,
    impactCost: 55,
    acceleration: 95,
  },
] as const;
export type ShipId = (typeof SHIPS)[number]["id"];

/** Original low-poly hulls; local +Z is the nose, -Z is the exhaust. */
export function createShip(id: Exclude<ShipId, "jet">): THREE.Group {
  const spec = SHIPS.find((ship) => ship.id === id)!;
  const ship = new THREE.Group();
  ship.name = spec.name;
  const hull = new THREE.MeshStandardMaterial({
    color: 0x43516a,
    metalness: 0.3,
    roughness: 0.35,
    flatShading: true,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: spec.color,
    metalness: 0.45,
    roughness: 0.3,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x09152b,
    emissive: spec.color,
    emissiveIntensity: 0.015,
    metalness: 0.15,
    roughness: 0.15,
  });
  const glow = new THREE.MeshBasicMaterial({ color: spec.color });
  const mesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: number[],
    scale = [1, 1, 1],
  ) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.fromArray(position);
    part.scale.fromArray(scale);
    ship.add(part);
    return part;
  };
  const wedge = (
    outline: number[][],
    thickness: number,
    material: THREE.Material,
  ) => {
    const shape = new THREE.Shape(
      outline.map(([x, z]) => new THREE.Vector2(x, z)),
    );
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 1,
      steps: 1,
    });
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, thickness / 2, 0);
    return mesh(geometry, material, [0, 0, 0]);
  };
  const engine = (x: number, z: number, size = 0.45) => {
    const pod = mesh(
      new THREE.CylinderGeometry(size, size * 0.8, 2.8, 8),
      hull,
      [x, -0.2, z],
    );
    pod.rotation.x = Math.PI / 2;
    const nozzle = mesh(
      new THREE.CylinderGeometry(size * 0.8, size, 0.25, 12),
      glow,
      [x, -0.2, z - 1.5],
    );
    nozzle.rotation.x = Math.PI / 2;
    const flame = mesh(new THREE.ConeGeometry(size * 0.45, 3.5, 16), glow, [
      x,
      -0.2,
      z - 2.8,
    ]);
    flame.rotation.x = -Math.PI / 2;
    flame.name = "exhaust";
  };
  if (id === "dart") {
    wedge(
      [
        [0, 5],
        [1.1, 0.5],
        [4.2, -2.5],
        [0.8, -1.7],
        [0, -3],
        [-0.8, -1.7],
        [-4.2, -2.5],
        [-1.1, 0.5],
      ],
      0.5,
      hull,
    );
    wedge(
      [
        [0, 4.6],
        [0.25, 0],
        [3.8, -2.3],
        [1, -1],
        [0, 1.5],
        [-1, -1],
        [-3.8, -2.3],
        [-0.25, 0],
      ],
      0.57,
      trim,
    );
    mesh(
      new THREE.SphereGeometry(1, 12, 8),
      glass,
      [0, 0.55, 0.7],
      [0.55, 0.55, 1.4],
    );
    const spine = mesh(
      new THREE.ConeGeometry(0.55, 5, 4),
      hull,
      [0, 0.35, 0.7],
    );
    spine.rotation.x = Math.PI / 2;
    spine.rotation.z = Math.PI / 4;
    for (const side of [-1, 1]) {
      const fin = mesh(new THREE.BoxGeometry(0.12, 1.2, 1.8), trim, [
        side * 0.9,
        0.7,
        -1.5,
      ]);
      fin.rotation.z = side * -0.25;
    }
    engine(-0.65, -1.5);
    engine(0.65, -1.5);
  } else if (id === "twin") {
    wedge(
      [
        [0, 3.7],
        [1.2, 1],
        [1.4, -2.5],
        [-1.4, -2.5],
        [-1.2, 1],
      ],
      0.9,
      hull,
    );
    mesh(new THREE.BoxGeometry(6.8, 0.3, 1.5), trim, [0, 0, -0.5]);
    for (const side of [-1, 1]) {
      const prow = mesh(new THREE.ConeGeometry(0.85, 3.5, 4), trim, [
        side * 2.8,
        0,
        2.3,
      ]);
      prow.rotation.x = Math.PI / 2;
      prow.rotation.z = Math.PI / 4;
      mesh(new THREE.BoxGeometry(1.2, 0.9, 4), hull, [side * 2.8, 0, -0.5]);
      engine(side * 2.8, -2, 0.7);
      const fin = mesh(new THREE.BoxGeometry(0.2, 1.6, 2), trim, [
        side * 2.8,
        0.8,
        -1.6,
      ]);
      fin.rotation.z = side * -0.25;
    }
    mesh(
      new THREE.SphereGeometry(1, 12, 8),
      glass,
      [0, 0.65, 0.6],
      [0.65, 0.5, 1.2],
    );
  } else {
    wedge(
      [
        [0, 4],
        [1.5, 1.2],
        [5.4, 2],
        [4.6, -1],
        [2, -2.4],
        [0, -1.7],
        [-2, -2.4],
        [-4.6, -1],
        [-5.4, 2],
        [-1.5, 1.2],
      ],
      0.4,
      hull,
    );
    wedge(
      [
        [0, 3.8],
        [0.8, 0.5],
        [5.1, 1.9],
        [4.4, 0.8],
        [0, -0.4],
        [-4.4, 0.8],
        [-5.1, 1.9],
        [-0.8, 0.5],
      ],
      0.48,
      trim,
    );
    mesh(
      new THREE.SphereGeometry(1, 16, 8),
      glass,
      [0, 0.4, 0.8],
      [0.9, 0.45, 1.3],
    );
    for (const side of [-1, 1]) {
      const pod = mesh(
        new THREE.SphereGeometry(1, 10, 6),
        hull,
        [side * 1.8, 0.15, -0.1],
        [0.6, 0.4, 2.2],
      );
      pod.rotation.y = side * -0.15;
      mesh(new THREE.BoxGeometry(0.08, 0.12, 2.6), glow, [side * 3.3, 0.29, 0]);
    }
    engine(-1.8, -1.5, 0.55);
    engine(1.8, -1.5, 0.55);
  }
  return ship;
}
