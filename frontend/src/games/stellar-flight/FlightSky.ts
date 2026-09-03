import * as THREE from "three";

export function createFlightSky(
  scene: THREE.Scene,
  streakPositions: Float32Array,
) {
  const positions = new Float32Array(1200 * 3);
  const colors = new Float32Array(positions.length);
  const color = new THREE.Color();
  for (let i = 0; i < 1200; i++) {
    const angle = Math.random() * Math.PI * 2,
      y = Math.random() * 2 - 1;
    const radius = Math.sqrt(1 - y * y);
    positions.set(
      [
        9000 * radius * Math.cos(angle),
        9000 * y,
        9000 * radius * Math.sin(angle),
      ],
      i * 3,
    );
    color.setHSL(0.12 + Math.random() * 0.55, 0.13, 0.4 + Math.random() * 0.5);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  scene.add(
    new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 1.8,
        sizeAttenuation: false,
        vertexColors: true,
        fog: false,
      }),
    ),
  );
  // Soft additive clouds form a distant nebula without network assets.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,0.25)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  for (let i = 0; i < 4; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        color: i % 2 ? 0x514261 : 0x234652,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    const angle = (i * Math.PI * 2) / 4 + 0.65;
    sprite.position.set(
      Math.sin(angle) * 6500,
      Math.sin(angle * 3) * 1700,
      Math.cos(angle) * 6500,
    );
    sprite.scale.set(5000, 3200, 1);
    scene.add(sprite);
  }
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(150, 20, 12),
    new THREE.MeshBasicMaterial({ color: 0xffefc8, fog: false }),
  );
  sun.position.set(3400, 1350, 6200);
  scene.add(sun);
  const corona = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color: 0xffb75e,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  corona.position.copy(sun.position);
  corona.scale.set(1800, 1800, 1);
  scene.add(corona);
  for (let i = 0; i < 80; i++)
    streakPositions.set(
      [
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 70,
        Math.random() * 130,
        0,
        0,
        0,
      ],
      i * 6,
    );
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(streakPositions, 3),
  );
  const streaks = new THREE.LineSegments(
    streakGeometry,
    new THREE.LineBasicMaterial({
      color: 0x8edbf5,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  scene.add(streaks);
  return streaks;
}
