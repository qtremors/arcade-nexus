import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Game3DInstance, InputState } from '../../sdk/GameSDK';
import { FlightController } from './FlightController';

export class StellarFlightGame implements Game3DInstance {
    readonly type = '3d' as const;

    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private jet: THREE.Group | null = null;
    private terrain!: THREE.Mesh;
    private controller = new FlightController();

    private isInitialized = false;

    // Maps
    private currentMapIndex = 0;
    private maps = [
        { name: 'Earth', sky: 0x87CEEB, ground: 0x4CAF50, fog: 0x87CEEB },
        { name: 'Mars', sky: 0xFF7043, ground: 0x8D6E63, fog: 0xFFCCBC },
        { name: 'Space', sky: 0x000000, ground: 0x111111, fog: 0x000000 },
    ];

    async init(canvas: HTMLCanvasElement): Promise<void> {
        // 1. Setup Three.js
        this.scene = new THREE.Scene();

        const fov = 75;
        const aspect = canvas.width / canvas.height;
        this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 20000);
        this.camera.position.set(0, 10, -20);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        this.renderer.setSize(canvas.width, canvas.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // 2. Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(100, 200, 50);
        this.scene.add(dirLight);

        // 3. Environment
        this.setupMap(0);

        // 4. Load Model
        const loader = new GLTFLoader();
        try {
            const gltf = await loader.loadAsync('/models/Jet.glb');
            this.jet = gltf.scene;
            this.jet.scale.set(1, 1, 1);
            this.scene.add(this.jet);
        } catch (e) {
            console.error("Failed to load Jet.glb", e);
            // Fallback object
            const geo = new THREE.ConeGeometry(1, 4, 8);
            geo.rotateX(Math.PI / 2);
            const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            this.jet = new THREE.Group();
            this.jet.add(new THREE.Mesh(geo, mat));
            this.scene.add(this.jet);
        }

        this.isInitialized = true;
    }

    private setupMap(index: number) {
        const map = this.maps[index];
        this.currentMapIndex = index;

        if (import.meta.env.DEV) {
            console.log(`[AetherFlight] Map switched to: ${map.name} (${this.currentMapIndex})`);
        }

        // Fog
        if (map.name !== 'Space') {
            this.scene.fog = new THREE.FogExp2(map.fog, 0.002);
            this.scene.background = new THREE.Color(map.sky);
        } else {
            this.scene.fog = null;
            this.scene.background = new THREE.Color(0x000000);
        }

        // Terrain
        if (this.terrain) this.scene.remove(this.terrain);

        if (map.name !== 'Space') {
            const textureLoader = new THREE.TextureLoader();
            const gridTexture = textureLoader.load('/textures/grid.png');
            gridTexture.wrapS = THREE.RepeatWrapping;
            gridTexture.wrapT = THREE.RepeatWrapping;
            gridTexture.repeat.set(100, 100);

            const planeGeo = new THREE.PlaneGeometry(10000, 10000);
            const planeMat = new THREE.MeshStandardMaterial({
                color: map.ground,
                map: gridTexture,
                roughness: 0.8
            });
            this.terrain = new THREE.Mesh(planeGeo, planeMat);
            this.terrain.rotation.x = -Math.PI / 2;
            this.terrain.position.y = -50;
            this.scene.add(this.terrain);
        }
    }

    update(deltaTime: number, input: InputState): boolean {
        if (!this.isInitialized || !this.jet) return true;

        const dt = deltaTime / 1000;
        this.controller.update(dt, input);

        // Map Switching (Keys 1-3)
        if (input.keys['1']) this.setupMap(0);
        if (input.keys['2']) this.setupMap(1);
        if (input.keys['3']) this.setupMap(2);

        // Apply rotation
        const deltaRot = this.controller.getDeltaRotation(dt);
        this.jet.rotateX(deltaRot.x);
        this.jet.rotateY(deltaRot.y);
        this.jet.rotateZ(deltaRot.z);

        // Move forward
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.jet.quaternion);
        this.jet.position.add(forward.multiplyScalar(this.controller.speed * dt));

        // Camera follow
        const relativeCameraOffset = new THREE.Vector3(0, 5, -15);
        const cameraOffset = relativeCameraOffset.applyMatrix4(this.jet.matrixWorld);

        this.camera.position.lerp(cameraOffset, 5 * dt); // Smooth follow
        this.camera.lookAt(this.jet.position);

        return true;
    }

    render(): void {
        if (!this.isInitialized) return;
        this.renderer.render(this.scene, this.camera);
    }

    getScore(): number {
        return Math.floor(this.controller.speed); // Temporary score = speed
    }

    destroy(): void {
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss();
        }
    }
}
