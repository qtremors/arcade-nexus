import * as THREE from "three";
import "./prism.css";
import { fullHdScale, graphicsCapabilities } from "../../sdk/GraphicsQuality";
import type { Game3DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { GameFeedback } from "../feedback";
import { useSettingsStore } from "../../stores/settingsStore";
import { PrismRun } from "./PrismRun";
export class PrismRushGame implements Game3DInstance {
  readonly type = "3d" as const;
  private run = new PrismRun();
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 180);
  private ship = new THREE.Group();
  private barriers!: THREE.InstancedMesh;
  private gems!: THREE.InstancedMesh;
  private stripes!: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private hud: HTMLDivElement | null = null;
  private resize: ResizeObserver | null = null;
  private feedback = new GameFeedback();
  private notice = "Gold crystals mark the opening";
  private noticeTime = 3;
  init(canvas: HTMLCanvasElement, config: GameConfig): void {
    this.run = new PrismRun(config.seed, config.difficulty);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context:
        canvas.getContext("webgl2", {
          alpha: false,
          antialias: true,
          desynchronized: true,
          powerPreference: "high-performance",
        }) ?? undefined,
      antialias: true,
      powerPreference: "high-performance",
    });
    const resize = () => {
      const w = canvas.clientWidth || 960,
        h = canvas.clientHeight || 640;
      this.renderer?.setPixelRatio(fullHdScale(w, h));
      this.renderer?.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      if (this.hud) {
        this.hud.style.top = `${canvas.offsetTop + 18}px`;
        this.hud.style.left = `${canvas.offsetLeft + 22}px`;
      }
    };
    this.resize = new ResizeObserver(resize);
    this.resize.observe(canvas);
    resize();
    this.scene.background = new THREE.Color(0x090c20);
    this.scene.fog = new THREE.Fog(0x090c20, 40, 135);
    this.camera.position.set(0, 5.5, 10);
    this.camera.lookAt(0, 0, -20);
    this.scene.add(new THREE.HemisphereLight(0x92eaff, 0x211333, 2));
    const sun = new THREE.DirectionalLight(0xd3dcff, 3);
    sun.position.set(-5, 12, 5);
    this.scene.add(sun);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 170),
      new THREE.MeshStandardMaterial({ color: 0x17223a, roughness: 0.7 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.45, -70);
    this.scene.add(road);
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x367c98 });
    const lines = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.045, 0.02, 170),
      lineMaterial,
      4,
    );
    [-4.4, -1.4, 1.4, 4.4].forEach((x, i) => {
      this.dummy.position.set(x, -0.4, -70);
      this.dummy.updateMatrix();
      lines.setMatrixAt(i, this.dummy.matrix);
    });
    this.scene.add(lines);
    this.stripes = new THREE.InstancedMesh(
      new THREE.BoxGeometry(9, 0.025, 0.08),
      lineMaterial,
      25,
    );
    for (let i = 0; i < 25; i++) {
      this.dummy.position.set(0, -0.4, 8 - i * 6);
      this.dummy.updateMatrix();
      this.stripes.setMatrixAt(i, this.dummy.matrix);
    }
    this.scene.add(this.stripes);
    const hull = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1.6, 4),
      new THREE.MeshStandardMaterial({
        color: 0x73e6ed,
        emissive: 0x145a66,
        metalness: 0.4,
        roughness: 0.3,
      }),
    );
    hull.rotation.x = -Math.PI / 2;
    hull.rotation.z = Math.PI / 4;
    this.ship.add(hull);
    const engine = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd983 }),
    );
    engine.position.z = 0.8;
    this.ship.add(engine);
    this.scene.add(this.ship);
    const barrierGeometry = new THREE.BoxGeometry(2.1, 1.6, 1.5),
      barrierMaterial = new THREE.MeshStandardMaterial({
        color: 0xff668c,
        emissive: 0x7c1638,
        roughness: 0.4,
      });
    const gemGeometry = new THREE.OctahedronGeometry(0.5),
      gemMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd778,
        emissive: 0x886315,
        metalness: 0.4,
        roughness: 0.2,
      });
    this.barriers = new THREE.InstancedMesh(
      barrierGeometry,
      barrierMaterial,
      24,
    );
    this.gems = new THREE.InstancedMesh(gemGeometry, gemMaterial, 12);
    for (const mesh of [this.barriers, this.gems]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Rows move through a small, fixed corridor; avoid stale instance bounds.
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.scene.add(mesh);
    }
    const archMaterial = new THREE.MeshBasicMaterial({ color: 0x423e78 });
    const columns = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.15, 8, 0.15),
      archMaterial,
      18,
    );
    const tops = new THREE.InstancedMesh(
      new THREE.BoxGeometry(10.5, 0.15, 0.15),
      archMaterial,
      9,
    );
    for (let i = 0; i < 9; i++) {
      for (let side = 0; side < 2; side++) {
        this.dummy.position.set((side * 2 - 1) * 5.2, 3, -i * 18);
        this.dummy.updateMatrix();
        columns.setMatrixAt(i * 2 + side, this.dummy.matrix);
      }
      this.dummy.position.set(0, 7, -i * 18);
      this.dummy.updateMatrix();
      tops.setMatrixAt(i, this.dummy.matrix);
    }
    this.scene.add(columns, tops);
    this.hud = document.createElement("div");
    this.hud.className = "prism-hud";
    this.hud.setAttribute("aria-label", "Prism Rush instruments");
    Object.assign(this.hud.style, {
      position: "absolute",
      top: "18px",
      left: "22px",
      maxWidth: "calc(100% - 44px)",
      padding: "12px 16px",
      background: "#090c20cc",
      border: "1px solid #367c9866",
      borderRadius: "10px",
      lineHeight: "1.5",
      pointerEvents: "none",
      color: "#dffaff",
      fontFamily: "Rajdhani, system-ui",
      fontSize: "clamp(14px, 2vw, 22px)",
      textShadow: "0 2px 5px #000",
      zIndex: "1",
      whiteSpace: "pre-line",
    });
    canvas.parentElement?.appendChild(this.hud);
    resize();
  }
  update(dt: number, input: InputState): boolean {
    const event = this.run.update(dt, input);
    this.noticeTime = Math.max(0, this.noticeTime - dt / 1000);
    if (event) {
      this.notice =
        event === "hit" ? "SHIELD LOST · Find the clear lane" : "CRYSTAL +100";
      this.noticeTime = 1.2;
    }
    if (event) this.feedback.sound(event === "hit" ? "miss" : "collect");
    return this.run.lives > 0;
  }
  render(): void {
    if (!this.renderer) return;
    const reduced = useSettingsStore.getState().reducedMotion;
    this.ship.position.set(this.run.x, 0.15, 0);
    this.ship.rotation.z = reduced
      ? 0
      : -(this.run.lane * 2.8 - 2.8 - this.run.x) * 0.13;
    this.stripes.position.z = reduced ? 0 : this.run.distance % 6;
    let blocks = 0,
      crystals = 0;
    for (const gate of this.run.rows) {
      this.dummy.rotation.set(0, 0, 0);
      for (let lane = 0; lane < 3; lane++) {
        if (lane === gate.safe) continue;
        this.dummy.position.set((lane - 1) * 2.8, 0.4, gate.z);
        this.dummy.updateMatrix();
        this.barriers.setMatrixAt(blocks++, this.dummy.matrix);
      }
      if (!gate.passed) {
        this.dummy.position.set((gate.safe - 1) * 2.8, 0.65, gate.z);
        this.dummy.rotation.y = reduced ? 0 : this.run.elapsed;
        this.dummy.updateMatrix();
        this.gems.setMatrixAt(crystals++, this.dummy.matrix);
      }
    }
    this.barriers.count = blocks;
    this.gems.count = crystals;
    this.barriers.instanceMatrix.needsUpdate = true;
    this.gems.instanceMatrix.needsUpdate = true;
    if (this.hud) {
      const content = `PRISM RUSH     ${this.run.score.toLocaleString()} POINTS\n${this.run.lives} SHIELDS  ·  ${this.run.crystals} CRYSTALS  ·  ${Math.floor(this.run.distance)} m\n← → Change lane   ↓ Brake\n${this.noticeTime > 0 ? this.notice : ""}`;
      if (this.hud.textContent !== content) this.hud.textContent = content;
    }
    this.renderer.render(this.scene, this.camera);
  }
  getRenderInfo() {
    return {
      renderer: graphicsCapabilities().renderer,
      quality: "1080p · full scene detail",
      width: this.renderer?.domElement.width,
      height: this.renderer?.domElement.height,
    };
  }
  getScore() {
    return this.run.score;
  }
  getMetrics() {
    return { lives: this.run.lives };
  }
  getResult() {
    return {
      title: "Highway run complete",
      detail: `${Math.floor(this.run.distance)} metres · ${this.run.crystals} crystals · ${this.run.score} points`,
    };
  }
  getState() {
    return this.run.getState();
  }
  setState(state: Record<string, unknown>) {
    this.run.setState(state);
  }
  destroy(): void {
    this.resize?.disconnect();
    this.resize = null;
    this.hud?.remove();
    this.hud = null;
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object instanceof THREE.InstancedMesh) object.dispose();
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material])
          materials.add(material);
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.scene.clear();
    this.renderer?.dispose();
    this.renderer = null;
  }
}
