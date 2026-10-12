import { z } from "zod";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Game3DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { FlightController } from "./FlightController";
import { crossGate, terrainHeight, TERRAIN_STEP } from "./course";
import { GameFeedback } from "../feedback";

export class StellarFlightGame implements Game3DInstance {
  readonly type = "3d" as const;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private jet: THREE.Group | null = null;
  private terrain: THREE.Mesh | null = null;
  private stars: THREE.Points | null = null;
  private controller = new FlightController();

  private isInitialized = false;
  private disposed = false;
  private mapKey: string | null = null;
  private bestSpeed = 0;
  private mode = "classic";
  private elapsed = 0;
  private courseFinished = false;
  private worldHeld = false;
  private maxAltitude = 150;
  private crashed = false;
  private readonly forward = new THREE.Vector3();
  private readonly cameraOffset = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private hud: HTMLDivElement | null = null;
  private gate: THREE.Mesh<
    THREE.TorusGeometry,
    THREE.MeshBasicMaterial
  > | null = null;
  private gatesPassed = 0;
  private gatesMissed = 0;
  private gateMessage = "Follow the cyan gates";
  private gateMessageTime = 0;
  private previousPosition = new THREE.Vector3();
  private gateNormal = new THREE.Vector3();
  private bankRotation = new THREE.Euler(0, 0, 0, "YXZ");
  private worldUp = new THREE.Vector3(0, 1, 0);
  private feedback = new GameFeedback();

  // Maps
  private currentMapIndex = 0;
  private maps = [
    { name: "Earth", sky: 0x87ceeb, ground: 0x4caf50, fog: 0x87ceeb },
    { name: "Mars", sky: 0xff7043, ground: 0x8d6e63, fog: 0xffccbc },
    { name: "Space", sky: 0x000000, ground: 0x111111, fog: 0x000000 },
  ];

  async init(canvas: HTMLCanvasElement, config: GameConfig): Promise<void> {
    this.mode = config.mode ?? "classic";
    // 1. Setup Three.js
    this.scene = new THREE.Scene();

    const fov = 75;
    const aspect = canvas.width / canvas.height;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 20000);
    this.camera.position.set(0, 10, -20);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    this.scene.add(new THREE.HemisphereLight(0xd9eaff, 0x69796b, 1.5));

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(100, 200, 50);
    this.scene.add(dirLight);

    // Distant stars give the space map visible depth and motion reference.
    const vertices = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000; i++) {
      const theta = Math.random() * Math.PI * 2,
        z = Math.random() * 2 - 1;
      const radius = Math.sqrt(1 - z * z);
      vertices.set(
        [
          8000 * radius * Math.cos(theta),
          8000 * z,
          8000 * radius * Math.sin(theta),
        ],
        i * 3,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    this.stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xd9eaff,
        size: 2,
        sizeAttenuation: false,
      }),
    );
    this.scene.add(this.stars);
    // 3. Environment
    this.setupMap(0);

    // 4. Load Model
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync(
        typeof config.model_path === "string"
          ? config.model_path
          : "/models/Jet.glb",
      );
      if (this.disposed) {
        this.disposeObject(gltf.scene);
        return;
      }
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          if (material instanceof THREE.MeshStandardMaterial)
            material.metalness = Math.min(material.metalness, 0.35);
        }
      });
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3()),
        size = box.getSize(new THREE.Vector3());
      const centered = new THREE.Group();
      gltf.scene.position.sub(center);
      centered.add(gltf.scene);
      centered.scale.setScalar(8 / Math.max(size.x, size.y, size.z, 0.001));
      this.jet = new THREE.Group();
      this.jet.add(centered);
      this.scene.add(this.jet);
    } catch (e) {
      if (this.disposed) return;
      console.warn("Using fallback aircraft", e);
      // Fallback object
      const geo = new THREE.ConeGeometry(1, 4, 8);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      this.jet = new THREE.Group();
      this.jet.add(new THREE.Mesh(geo, mat));
      this.scene.add(this.jet);
    }

    this.jet!.position.set(0, 100, 0);
    this.controller.speed =
      typeof config.initial_speed === "number" ? config.initial_speed : 50;
    this.bestSpeed = this.controller.speed;
    this.camera.position.set(0, 105, -16);
    this.camera.lookAt(this.jet!.position);
    this.hud = document.createElement("div");
    this.hud.className = "flight-hud";
    this.hud.setAttribute("aria-label", "Flight instruments");
    canvas.parentElement?.appendChild(this.hud);
    this.gate = new THREE.Mesh(
      new THREE.TorusGeometry(28, 1.8, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xffdd55, fog: false }),
    );
    this.scene.add(this.gate);
    this.placeGate(true);
    this.isInitialized = true;
  }
  private placeGate(first = false): void {
    if (!this.jet || !this.gate) return;
    const index = this.gatesPassed + this.gatesMissed;
    const lateral = first ? 0 : [35, -35, 0, 45, -45, 0][index % 6];
    const vertical = first ? 0 : [10, 20, -10, 15, 0, -15][index % 6];
    this.gate.position
      .set(
        lateral,
        vertical,
        Math.max(first ? 300 : 400, this.controller.speed * 3),
      )
      .applyQuaternion(this.jet.quaternion)
      .add(this.jet.position);
    // Keep training gates above ground on planet maps.
    if (this.currentMapIndex !== 2)
      this.gate.position.y = Math.max(
        terrainHeight(
          this.gate.position.x,
          this.gate.position.z,
          this.currentMapIndex,
        ) + 70,
        this.gate.position.y,
      );
    this.gate.quaternion.copy(this.jet.quaternion);
  }

  private setupMap(index: number) {
    const map = this.maps[index];
    this.currentMapIndex = index;
    if (this.stars) this.stars.visible = index === 2;

    if (import.meta.env.DEV) {
      console.log(
        `[StellarFlight] Map switched to: ${map.name} (${this.currentMapIndex})`,
      );
    }

    // Fog
    if (map.name !== "Space") {
      this.scene.fog = new THREE.FogExp2(map.fog, 0.00055);
      this.scene.background = new THREE.Color(map.sky);
    } else {
      this.scene.fog = null;
      this.scene.background = new THREE.Color(0x000000);
    }

    // Terrain
    if (this.terrain) {
      this.scene.remove(this.terrain);
      this.disposeObject(this.terrain);
      this.terrain = null;
    }

    if (map.name !== "Space") {
      const planeGeo = new THREE.PlaneGeometry(10000, 10000, 64, 64);
      planeGeo.setAttribute(
        "color",
        new THREE.BufferAttribute(
          new Float32Array(planeGeo.attributes.position.count * 3),
          3,
        ),
      );
      const planeMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 1,
      });
      this.terrain = new THREE.Mesh(planeGeo, planeMat);
      this.terrain.rotation.x = -Math.PI / 2;
      this.terrain.position.y = -50;
      this.scene.add(this.terrain);
      this.refreshTerrain();
    }
  }
  private refreshTerrain(): void {
    if (!this.terrain) return;
    const centerX =
      Math.round((this.jet?.position.x ?? 0) / TERRAIN_STEP) * TERRAIN_STEP;
    const centerZ =
      Math.round((this.jet?.position.z ?? 0) / TERRAIN_STEP) * TERRAIN_STEP;
    this.terrain.position.x = centerX;
    this.terrain.position.z = centerZ;
    const geometry = this.terrain.geometry,
      positions = geometry.attributes.position,
      colors = geometry.attributes.color,
      color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const height = terrainHeight(
        positions.getX(i) + centerX,
        -positions.getY(i) + centerZ,
        this.currentMapIndex,
      );
      positions.setZ(i, height + 50);
      const elevation = Math.max(0, Math.min(1, (height + 190) / 280));
      color.setHSL(
        this.currentMapIndex === 1
          ? 0.065
          : height < -90
            ? 0.55
            : height > 45
              ? 0.1
              : 0.35,
        this.currentMapIndex === 1 ? 0.38 : height > 45 ? 0.1 : 0.25,
        0.15 + elevation * 0.2,
      );
      colors.setXYZ(i, color.r, color.g, color.b);
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }

  update(deltaTime: number, input: InputState): boolean {
    if (!this.isInitialized || !this.jet) return true;

    if (this.courseFinished) return false;
    const dt = deltaTime / 1000;
    this.elapsed += dt;
    this.previousPosition.copy(this.jet.position);
    this.gateMessageTime = Math.max(0, this.gateMessageTime - dt);
    this.controller.update(dt, input);

    // Map Switching (Keys 1-3)
    const key =
      ["Digit1", "Digit2", "Digit3"].find((key) => input.keys[key]) ?? null;
    if (this.mode === "classic") {
      const cycle = !!input.keys.KeyM;
      if (cycle && !this.worldHeld) {
        this.setupMap((this.currentMapIndex + 1) % 3);
        this.placeGate(true);
      }
      this.worldHeld = cycle;
      if (key && key !== this.mapKey) {
        this.setupMap(Number(key.slice(-1)) - 1);
        this.placeGate(true);
      }
    }
    this.mapKey = key;

    // Apply rotation
    const deltaRot = this.controller.getDeltaRotation(dt);
    this.jet.rotateX(deltaRot.x);
    this.jet.rotateY(deltaRot.y);
    this.jet.rotateZ(deltaRot.z);
    this.bankRotation.setFromQuaternion(this.jet.quaternion, "YXZ");
    this.jet.rotateOnWorldAxis(
      this.worldUp,
      this.controller.getBankTurn(dt, this.bankRotation.z),
    );

    // Move forward
    const forward = this.forward.set(0, 0, 1);
    forward.applyQuaternion(this.jet.quaternion);
    this.jet.position.add(forward.multiplyScalar(this.controller.speed * dt));
    if (
      this.terrain &&
      (Math.abs(this.jet.position.x - this.terrain.position.x) > 600 ||
        Math.abs(this.jet.position.z - this.terrain.position.z) > 600)
    )
      this.refreshTerrain();
    if (this.gate) {
      this.gateNormal.set(0, 0, 1).applyQuaternion(this.gate.quaternion);
      const crossing = crossGate(
        this.previousPosition.toArray(),
        this.jet.position.toArray(),
        this.gate.position.toArray(),
        this.gateNormal.toArray(),
      );
      if (crossing) {
        if (crossing === "pass") {
          this.gatesPassed++;
          this.gateMessage = "GATE CLEARED";
          this.feedback.sound("collect");
        } else {
          this.gatesMissed++;
          this.gateMessage = "GATE MISSED · Line up the next";
          this.feedback.sound("miss");
        }
        this.gateMessageTime = 2;
        if (this.mode === "course" && this.gatesPassed + this.gatesMissed >= 12)
          this.courseFinished = true;
        else this.placeGate();
      }
    }

    // Camera follow
    this.jet.updateMatrixWorld(true);
    const relativeCameraOffset = this.cameraOffset.set(0, 3.5, -13);
    const cameraOffset = relativeCameraOffset.applyMatrix4(
      this.jet.matrixWorld,
    );

    // Follow in aircraft space so high speeds do not leave the camera hundreds of units behind.
    this.camera.position.copy(cameraOffset);
    this.camera.up.set(0, 1, 0).applyQuaternion(this.jet.quaternion);
    this.lookTarget
      .set(0, 0, 8)
      .applyQuaternion(this.jet.quaternion)
      .add(this.jet.position);
    this.camera.lookAt(this.lookTarget);
    this.stars?.position.copy(this.camera.position);

    this.bestSpeed = Math.max(this.bestSpeed, this.controller.speed);
    this.maxAltitude = Math.max(this.maxAltitude, this.jet.position.y + 50);
    const clearance =
      this.jet.position.y -
      terrainHeight(
        this.jet.position.x,
        this.jet.position.z,
        this.currentMapIndex,
      );
    this.crashed = this.currentMapIndex !== 2 && clearance <= 2;
    if (this.hud) {
      const distance = this.gate
        ? Math.round(this.jet.position.distanceTo(this.gate.position))
        : 0;
      this.hud.textContent = `${this.maps[this.currentMapIndex].name} · Speed ${Math.floor(this.controller.speed)} m/s · ${this.currentMapIndex === 2 ? "Altitude" : "Ground clearance"} ${Math.floor(this.currentMapIndex === 2 ? this.jet.position.y + 50 : clearance)} m\nGates ${this.gatesPassed} cleared / ${this.gatesMissed} missed${this.mode === "course" ? ` · ${this.gatesPassed + this.gatesMissed}/12 · ${Math.floor(this.elapsed)}s` : ""} · Next ${distance} m\n${clearance < 40 && this.currentMapIndex !== 2 ? "PULL UP · LOW ALTITUDE" : this.gateMessageTime > 0 ? this.gateMessage : `${this.gate && this.gate.position.clone().sub(this.jet.position).applyQuaternion(this.jet.quaternion.clone().invert()).x > 15 ? "STEER RIGHT →" : this.gate && this.gate.position.clone().sub(this.jet.position).applyQuaternion(this.jet.quaternion.clone().invert()).x < -15 ? "← STEER LEFT" : "GATE AHEAD"} · ${this.mode === "classic" ? "Y / M changes world" : "12 gates · Finish the course"}`}`;
      this.hud.classList.toggle(
        "flight-warning",
        clearance < 40 && this.currentMapIndex !== 2,
      );
    }
    return !this.crashed && !this.courseFinished;
  }

  render(): void {
    if (!this.isInitialized) return;
    this.renderer.render(this.scene, this.camera);
  }

  getScore(): number {
    return this.mode === "classic"
      ? Math.floor(this.bestSpeed)
      : Math.max(
          0,
          this.gatesPassed * 1000 -
            this.gatesMissed * 250 +
            (this.courseFinished
              ? Math.max(0, Math.floor(3000 - this.elapsed * 10))
              : 0),
        );
  }

  getMetrics() {
    return {
      max_altitude: Math.max(0, this.maxAltitude),
      max_speed: this.bestSpeed,
      gates: this.gatesPassed,
      misses: this.gatesMissed,
      completed: this.courseFinished,
      ...(this.courseFinished
        ? {
            medal: (this.gatesMissed === 0 && this.elapsed < 180
              ? "gold"
              : this.gatesPassed >= 10
                ? "silver"
                : "bronze") as "gold" | "silver" | "bronze",
          }
        : {}),
      crashed: this.crashed,
    };
  }
  getState(): Record<string, unknown> {
    if (!this.jet) throw new Error("Aircraft is not ready");
    return {
      version: 1,
      mode: this.mode,
      elapsed: this.elapsed,
      courseFinished: this.courseFinished,
      maxAltitude: this.maxAltitude,
      position: this.jet.position.toArray(),
      rotation: this.jet.quaternion.toArray(),
      speed: this.controller.speed,
      bestSpeed: this.bestSpeed,
      map: this.currentMapIndex,
      gatesPassed: this.gatesPassed,
      gatesMissed: this.gatesMissed,
      gate: this.gate
        ? {
            position: this.gate.position.toArray(),
            rotation: this.gate.quaternion.toArray(),
          }
        : null,
    };
  }
  setState(state: Record<string, unknown>): void {
    const data = z
      .object({
        version: z.literal(1),
        mode: z.enum(["classic", "course"]).default("classic"),
        elapsed: z.number().min(0).max(604800).default(0),
        courseFinished: z.boolean().default(false),
        maxAltitude: z.number().min(0).max(10000000),
        position: z.array(z.number().min(-1e7).max(1e7)).length(3),
        rotation: z
          .array(z.number().min(-1).max(1))
          .length(4)
          .refine((a) => Math.abs(a.reduce((v, n) => v + n * n, 0) - 1) < 0.01),
        speed: z.number().min(0).max(450),
        bestSpeed: z.number().min(0).max(450),
        map: z.number().int().min(0).max(2),
        gatesPassed: z.number().int().min(0).max(1000000).default(0),
        gatesMissed: z.number().int().min(0).max(1000000).default(0),
        gate: z
          .object({
            position: z.array(z.number().min(-1e7).max(1e7)).length(3),
            rotation: z
              .array(z.number().min(-1).max(1))
              .length(4)
              .refine(
                (a) => Math.abs(a.reduce((v, n) => v + n * n, 0) - 1) < 0.01,
              ),
          })
          .nullable()
          .default(null),
      })
      .parse(state);
    if (!this.jet) return; // Validation also works before initialization.
    this.jet.position.fromArray(data.position);
    this.jet.quaternion.fromArray(data.rotation).normalize();
    this.mode = data.mode;
    this.elapsed = data.elapsed;
    this.courseFinished = data.courseFinished;
    this.maxAltitude = data.maxAltitude;
    this.crashed = false;
    this.controller.speed = data.speed;
    this.bestSpeed = data.bestSpeed;
    this.setupMap(data.map);
    this.gatesPassed = data.gatesPassed;
    this.gatesMissed = data.gatesMissed;
    if (this.gate && data.gate) {
      this.gate.position.fromArray(data.gate.position);
      this.gate.quaternion.fromArray(data.gate.rotation).normalize();
    } else this.placeGate(true);
    this.gateMessageTime = 0;
  }
  getResult(): { title: string; detail: string } {
    return {
      title: this.crashed
        ? "Flight ended"
        : this.courseFinished
          ? "Course complete"
          : "Flight complete",
      detail: `${this.gatesPassed} gates cleared · ${this.gatesMissed} missed · ${Math.floor(this.elapsed)}s · Peak speed ${Math.floor(this.bestSpeed)} m/s`,
    };
  }
  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Points))
        return;
      child.geometry?.dispose();
      for (const material of Array.isArray(child.material)
        ? child.material
        : [child.material]) {
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    });
  }
  destroy(): void {
    this.disposed = true;
    this.isInitialized = false;
    this.hud?.remove();
    this.hud = null;
    if (this.scene) {
      this.disposeObject(this.scene);
      this.scene.clear();
    }
    this.jet = null;
    if (this.renderer) this.renderer.dispose();
  }
}
