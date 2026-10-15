import { renderDiagnostics } from "../../sdk/RenderDiagnostics";
import { SharedLightingResources } from "../../sdk/SharedLightingResources";
import "./flight.css";
import { fullHdScale, graphicsCapabilities } from "../../sdk/GraphicsQuality";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Game3DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../stores/settingsStore";
import { SpaceJourney } from "./SpaceJourney";
import { FlightHUD } from "./FlightHUD";
import { FlightAudio } from "./FlightAudio";
import { createShip, type ShipId } from "./ships";
import { SECTOR_SIZE, type Sector } from "./universe";
import { AsteroidField } from "./AsteroidField";

export class StellarFlightGame implements Game3DInstance {
  readonly type = "3d" as const;
  private journey = new SpaceJourney();
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private lightingResources = new SharedLightingResources();
  private canvas: HTMLCanvasElement | null = null;
  private jet = new THREE.Group();
  private ships = new Map<ShipId, THREE.Group>();
  private sectors = new Map<string, THREE.Group>();
  private gates: THREE.Mesh[] = [];
  private raceRocks: THREE.InstancedMesh | null = null;
  private lastSectors: Sector[] | null = null;
  private worldRocks: AsteroidField | null = null;
  private worldOrigin = new THREE.Vector3();
  private lastRaceObstacles: SpaceJourney["raceObstacles"] | null = null;
  private raceOrigin = new THREE.Vector3();
  private rockGeometry = new THREE.IcosahedronGeometry(1, 1);
  private rockMaterial = new THREE.MeshLambertMaterial({
    color: 0x7d8b9d,
    flatShading: true,
  });
  private streaks: THREE.LineSegments | null = null;
  private streakPositions = new Float32Array(80 * 6);
  private hud: FlightHUD | null = null;
  private audio = new FlightAudio();
  private survey = new THREE.Group();
  private resize: ResizeObserver | null = null;
  private renderDelta = 0;
  private initialized = false;
  private disposed = false;
  private feedback = new GameFeedback();
  private currentShip: ShipId | null = null;
  private bank = 0;
  private hudTime = 0;
  private hudDelta = 0;
  private point = new THREE.Vector3();
  private offset = new THREE.Vector3();
  private dummy = new THREE.Object3D();

  getRenderDiagnostics() {
    return renderDiagnostics(this.renderer);
  }
  async init(canvas: HTMLCanvasElement, config: GameConfig): Promise<void> {
    this.journey = new SpaceJourney(
      typeof config.seed === "number" ? config.seed : undefined,
    );
    if (
      typeof config.initial_speed === "number" &&
      Number.isFinite(config.initial_speed)
    ) {
      this.journey.controller.speed = Math.max(
        35,
        Math.min(this.journey.maxSpeed, config.initial_speed),
      );
      this.journey.bestSpeed = this.journey.controller.speed;
    }
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030611);
    this.scene.fog = new THREE.FogExp2(0x070d20, 0.00011);
    this.camera = new THREE.PerspectiveCamera(
      78,
      canvas.width / canvas.height,
      0.1,
      18000,
    );
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context:
        canvas.getContext("webgl2", {
          alpha: false,
          antialias: true,
          desynchronized: true,
          powerPreference: "low-power",
        }) ?? undefined,
      antialias: true,
      powerPreference: "low-power",
    });
    this.resize = new ResizeObserver(() => this.resizeRenderer());
    this.resize.observe(canvas);
    this.resizeRenderer();
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.scene.add(new THREE.AmbientLight(0xd6e3ed, 1.15));
    const sun = new THREE.DirectionalLight(0xffd4a6, 2.6);
    sun.position.set(-100, 200, 100);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x547c9b, 0.8);
    rim.position.set(100, 0, -100);
    this.scene.add(rim);
    const rockPositions = this.rockGeometry.attributes.position;
    for (let i = 0; i < rockPositions.count; i++) {
      const x = rockPositions.getX(i),
        y = rockPositions.getY(i),
        z = rockPositions.getZ(i);
      const scale =
        0.88 + 0.1 * Math.sin(x * 17 + y * 11) * Math.cos(z * 13 - y * 5);
      rockPositions.setXYZ(i, x * scale, y * scale, z * scale);
    }
    this.rockGeometry.computeVertexNormals();
    this.rockGeometry.computeBoundingSphere();
    this.scene.add(this.jet);
    for (const id of ["dart", "twin", "crescent"] as const) {
      const ship = createShip(id);
      ship.visible = false;
      this.ships.set(id, ship);
      this.jet.add(ship);
    }
    this.createSky();
    const gateGeometry = new THREE.TorusGeometry(72, 2, 8, 64);
    for (let i = 0; i < 5; i++) {
      const gate = new THREE.Mesh(
        gateGeometry,
        new THREE.MeshBasicMaterial({
          color: 0x67e8f9,
          transparent: true,
          opacity: 1,
          fog: false,
        }),
      );
      this.gates.push(gate);
      this.scene.add(gate);
      const ticks = new THREE.Mesh(
        new THREE.TorusGeometry(80, 0.7, 4, 32),
        new THREE.MeshBasicMaterial({
          color: 0x7fa5c7,
          transparent: true,
          opacity: 0.45,
        }),
      );
      gate.add(ticks);
    }
    this.raceRocks = new THREE.InstancedMesh(
      this.rockGeometry,
      this.rockMaterial,
      10,
    );
    this.scene.add(this.raceRocks);
    this.hud = new FlightHUD(canvas);
    const beacon = new THREE.Mesh(
      new THREE.TorusGeometry(34, 1.4, 6, 40),
      new THREE.MeshBasicMaterial({ color: 0xb99bff, fog: false }),
    );
    beacon.rotation.x = Math.PI / 2;
    this.survey.add(beacon);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 160, 6),
      new THREE.MeshBasicMaterial({
        color: 0xb99bff,
        transparent: true,
        opacity: 0.25,
      }),
    );
    this.survey.add(pillar);
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
      this.survey.add(landmark);
    }
    this.scene.add(this.survey);
    this.syncWorld();
    this.syncShip();
    this.followCamera(1);
    // The original asset is one option alongside three independently built hulls.
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
          : [object.material])
          if (material instanceof THREE.MeshStandardMaterial)
            material.metalness = Math.min(material.metalness, 0.35);
      });
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      gltf.scene.position.sub(center);
      const model = new THREE.Group();
      model.add(gltf.scene);
      model.scale.setScalar(9 / Math.max(size.x, size.y, size.z, 0.001));
      model.visible = false;
      this.ships.set("jet", model);
      this.jet.add(model);
    } catch (error) {
      if (this.disposed) return;
      console.warn(
        "Original ship unavailable; procedural ships remain playable",
        error,
      );
    }
    this.lightingResources.observe(this.scene);
    this.initialized = true;
    this.audio.pause();
    this.hud?.update(this.journey, this.camera, 0);
  }
  private createSky() {
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
      color.setHSL(
        0.12 + Math.random() * 0.55,
        0.13,
        0.4 + Math.random() * 0.5,
      );
      colors.set([color.r, color.g, color.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.scene.add(
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
      this.scene.add(sprite);
    }
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(150, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0xffefc8, fog: false }),
    );
    sun.position.set(3400, 1350, 6200);
    this.scene.add(sun);
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
    this.scene.add(corona);
    for (let i = 0; i < 80; i++)
      this.streakPositions.set(
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
      new THREE.BufferAttribute(this.streakPositions, 3),
    );
    this.streaks = new THREE.LineSegments(
      streakGeometry,
      new THREE.LineBasicMaterial({
        color: 0x8edbf5,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    this.scene.add(this.streaks);
  }
  private createSectorGroup(sector: Sector): THREE.Group {
    const group = new THREE.Group();
    group.userData.seed = this.journey.seed;
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
  private syncWorld() {
    this.survey.position
      .fromArray(this.journey.target)
      .sub(this.journey.position);
    this.survey.visible = this.journey.navigation === "explore";
    const landmark = this.journey.landmark;
    for (const child of this.survey.children)
      if (child.name) child.visible = child.name === landmark;
    if (this.lastSectors !== this.journey.sectors) {
      this.lastSectors = this.journey.sectors;
      const needed = new Set(this.journey.sectors.map((sector) => sector.key));
      // Rebuild the asteroid batch only when streaming into a new neighborhood.
      const count = this.journey.sectors.reduce(
        (sum, sector) => sum + sector.asteroids.length,
        0,
      );
      if (!this.worldRocks || this.worldRocks.instanceMatrix.count < count) {
        if (this.worldRocks) {
          this.scene.remove(this.worldRocks);
          this.worldRocks.dispose();
        }
        this.worldRocks = new AsteroidField(
          this.rockGeometry,
          this.rockMaterial,
          count,
        );
        this.scene.add(this.worldRocks);
      }
      this.worldOrigin.copy(this.journey.position);
      const colors = [
        new THREE.Color(0x889dab),
        new THREE.Color(0xa39488),
        new THREE.Color(0x77879b),
      ];
      const rocks = this.journey.sectors.flatMap((sector) =>
        sector.asteroids.map((body, index) => {
          this.dummy.position.set(...body.position).sub(this.worldOrigin);
          this.dummy.scale.setScalar(body.radius);
          this.dummy.rotation.set(index * 0.7, index * 1.3, index * 0.5);
          this.dummy.updateMatrix();
          return {
            matrix: this.dummy.matrix.clone(),
            sphere: this.rockGeometry
              .boundingSphere!.clone()
              .applyMatrix4(this.dummy.matrix),
            color: colors[index % 3],
          };
        }),
      );
      this.worldRocks.setRocks(rocks);
      for (const [key, group] of this.sectors) {
        if (needed.has(key) && group.userData.seed === this.journey.seed)
          continue;
        this.scene.remove(group);
        group.traverse((child) => {
          if (child instanceof THREE.InstancedMesh) child.dispose();
          else if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            for (const material of Array.isArray(child.material)
              ? child.material
              : [child.material])
              material.dispose();
          }
        });
        this.sectors.delete(key);
      }
      for (const sector of this.journey.sectors) {
        if (!this.sectors.has(sector.key)) {
          const group = this.createSectorGroup(sector);
          this.sectors.set(sector.key, group);
          this.scene.add(group);
        }
      }
    }
    this.worldRocks?.position.copy(this.worldOrigin).sub(this.journey.position);
    for (const group of this.sectors.values()) {
      // Ship stays at the render origin; distant journeys retain GPU precision.
      group.position
        .copy(group.userData.center as THREE.Vector3)
        .sub(this.journey.position);
    }
    if (this.raceRocks) {
      if (this.lastRaceObstacles !== this.journey.raceObstacles) {
        this.lastRaceObstacles = this.journey.raceObstacles;
        this.raceOrigin.copy(this.journey.position);
        this.journey.raceObstacles.forEach((body, index) => {
          this.dummy.position.set(...body.position).sub(this.raceOrigin);
          this.dummy.scale.setScalar(body.radius);
          this.dummy.rotation.set(index * 1.3, index * 0.6, 0);
          this.dummy.updateMatrix();
          this.raceRocks!.setMatrixAt(index, this.dummy.matrix);
        });
        this.raceRocks.instanceMatrix.needsUpdate = true;
        this.raceRocks.computeBoundingSphere();
      }
      this.raceRocks.position.copy(this.raceOrigin).sub(this.journey.position);
    }
    this.gates.forEach((mesh, i) => {
      mesh.visible =
        this.journey.navigation === "race" && i >= this.journey.gateIndex;
      mesh.position
        .fromArray(this.journey.gates[i].position)
        .sub(this.journey.position);
      mesh.quaternion.fromArray(this.journey.gates[i].rotation);
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.color.setHex(i === this.journey.gateIndex ? 0xffd777 : 0x67e8f9);
      material.opacity = i === this.journey.gateIndex ? 1 : 0.4;
    });
  }
  private syncShip() {
    if (this.currentShip === this.journey.ship) return;
    if (this.journey.ship === "jet" && !this.ships.has("jet")) {
      this.journey.ship = "dart";
      this.journey.message = "Original GLB unavailable · Flying Nova Dart";
      this.journey.messageTime = 4;
    }
    for (const [id, model] of this.ships)
      model.visible = id === this.journey.ship;
    this.currentShip = this.journey.ship;
    this.jet.userData.ship = this.currentShip;
  }
  private followCamera(dt: number) {
    this.bank +=
      (-this.journey.controller.inputRoll *
        (useSettingsStore.getState().reducedMotion ? 0.1 : 0.38) -
        this.bank) *
      Math.min(1, dt * 5);
    this.jet.quaternion.copy(this.journey.rotation);
    this.jet.rotateZ(this.bank);
    const view = this.journey.cameraView;
    this.jet.visible = view !== "nose";
    this.offset.set(
      0,
      view === "wide" ? 10 : view === "nose" ? 1 : 5.5,
      view === "wide" ? -34 : view === "nose" ? 2 : -22,
    );
    this.camera.position.copy(
      this.offset.applyQuaternion(this.journey.rotation),
    );
    this.camera.up.set(0, 1, 0).applyQuaternion(this.journey.rotation);
    this.camera.lookAt(
      this.point.set(0, 0.5, 38).applyQuaternion(this.journey.rotation),
    );
    const fov =
      (view === "nose" ? 80 : view === "wide" ? 66 : 70) +
      (this.journey.boosting && !useSettingsStore.getState().reducedMotion
        ? 9
        : 0);
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
  private resizeRenderer() {
    if (!this.canvas || !this.renderer) return;
    const width = Math.max(1, this.canvas.clientWidth),
      height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(fullHdScale(width, height));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  update(deltaTime: number, input: InputState): boolean {
    if (!this.initialized) return true;
    this.audio.resume();
    this.journey.update(deltaTime, input);
    if (this.journey.event) this.feedback.sound(this.journey.event);
    this.renderDelta += Math.min(0.1, deltaTime / 1000);
    return true;
  }
  private syncVisuals(dt: number) {
    this.syncWorld();
    this.syncShip();
    this.followCamera(dt);
    this.worldRocks?.updateView(this.camera);
    this.audio.update(this.journey.controller.speed, this.journey.boosting);
    const model = this.ships.get(this.journey.ship);
    model?.traverse((object) => {
      if (object.name === "exhaust")
        object.scale.y = this.journey.boosting ? 1.8 : 0.7;
    });
    if (this.streaks) {
      this.streaks.quaternion.copy(this.journey.rotation);
      this.streaks.visible =
        this.journey.controller.speed > 200 &&
        !useSettingsStore.getState().reducedMotion;
      for (let i = 0; i < 80; i++) {
        const offset = i * 6;
        this.streakPositions[offset + 2] -= this.journey.controller.speed * dt;
        if (this.streakPositions[offset + 2] < -25)
          this.streakPositions[offset + 2] += 155;
        this.streakPositions[offset + 3] = this.streakPositions[offset];
        this.streakPositions[offset + 4] = this.streakPositions[offset + 1];
        this.streakPositions[offset + 5] =
          this.streakPositions[offset + 2] + (this.journey.boosting ? 10 : 3);
      }
      this.streaks.geometry.attributes.position.needsUpdate = true;
    }
    this.hudTime -= dt;
    this.hudDelta += dt;
    if (this.hudTime <= 0) {
      this.hud?.update(this.journey, this.camera, this.hudDelta);
      this.hudDelta = 0;
      this.hudTime = 0.08;
    }
  }
  render(): void {
    if (!this.initialized) return;
    this.syncVisuals(Math.min(0.25, this.renderDelta));
    this.renderDelta = 0;
    this.renderer.render(this.scene, this.camera);
  }
  onPause(): void {
    this.audio.pause();
  }
  onResume(): void {
    this.audio.resume();
  }
  getRenderInfo() {
    return {
      renderer: graphicsCapabilities().renderer,
      quality: "1080p · full scene detail",
      width: this.canvas?.width,
      height: this.canvas?.height,
    };
  }
  getScore(): number {
    return this.journey.score;
  }
  getMetrics() {
    return {
      max_speed: this.journey.bestSpeed,
      max_altitude: Math.min(10000000, this.journey.maxAltitude),
      gates: Math.min(1000000, this.journey.gatesPassed),
      misses: Math.min(1000000, this.journey.gatesMissed),
      sectors: Math.min(1000000, this.journey.visited.size),
      crashed: this.journey.collisions > 0,
      completed: false,
      ...(this.journey.lastRace ? { medal: this.journey.lastRace.medal } : {}),
    };
  }
  getState(): Record<string, unknown> {
    return this.journey.getState();
  }
  setState(state: Record<string, unknown>): void {
    this.journey.setState(state);
    if (this.initialized) {
      this.syncWorld();
      this.currentShip = null;
      this.syncShip();
      this.followCamera(1);
      this.hud?.update(this.journey, this.camera, 0);
    }
  }
  getResult(): { title: string; detail: string } {
    return {
      title: "Journey paused",
      detail: `Level ${this.journey.level} · ${this.journey.visited.size} sectors explored · ${this.journey.races} races · ${this.journey.contractIndex} contracts · ${this.journey.scanned.size} sectors surveyed`,
    };
  }
  private disposeObject(object: THREE.Object3D) {
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
  destroy(): void {
    this.disposed = true;
    this.initialized = false;
    this.resize?.disconnect();
    this.resize = null;
    this.hud?.destroy();
    this.hud = null;
    this.audio.destroy();
    this.canvas = null;
    if (this.scene) {
      this.disposeObject(this.scene);
      this.scene.clear();
    }
    this.rockGeometry.dispose();
    this.rockMaterial.dispose();
    this.ships.clear();
    this.sectors.clear();
    this.gates = [];
    this.lightingResources.dispose();
    this.renderer?.dispose();
  }
}
