import { renderDiagnostics } from "../../sdk/RenderDiagnostics";
import { SharedLightingResources } from "../../sdk/SharedLightingResources";
import "./flight.css";
import { fullHdScale, graphicsCapabilities } from "../../sdk/GraphicsQuality";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Game3DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../shared/state/settingsStore";
import { SpaceJourney } from "./SpaceJourney";
import { FlightHUD } from "./FlightHUD";
import { FlightAudio } from "./FlightAudio";
import { createShip, type ShipId } from "./ships";
import type { Sector } from "./universe";
import { createFlightSky } from "./FlightSky";
import { createSectorGroup, createSurveyMarkers } from "./FlightWorld";
import { disposeFlightObject } from "./resources";
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
    this.streaks = createFlightSky(this.scene, this.streakPositions);
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
    this.survey = createSurveyMarkers();
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
        disposeFlightObject(gltf.scene);
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
          const group = createSectorGroup(sector, this.journey.seed);
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
      disposeFlightObject(this.scene);
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
