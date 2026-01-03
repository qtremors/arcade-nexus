import type { Game3DInstance, GameConfig, InputState } from '../../sdk/GameSDK';
import * as THREE from 'three';

export class SkyAceGame implements Game3DInstance {
    readonly type = '3d' as const;

    private renderer!: THREE.WebGLRenderer;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private planeGroup!: THREE.Group;

    // Environment
    private terrain!: THREE.Mesh;
    private clouds: THREE.Group[] = [];
    private targets: THREE.Mesh[] = [];

    // Flight Dynamics
    private speed = 0;
    private maxSpeed = 100;
    private accel = 40;


    private pitch = 0;  // Up/Down
    private roll = 0;   // Left/Right lean
    private yaw = 0;    // Left/Right rotation

    private rotationSpeed = 1.5;

    // State
    private score = 0;
    private time = 0;
    private gameOver = false;
    private worldSize = 10000;

    // Mouse Input
    private mouseX = 0;
    private mouseY = 0;
    private boundMouseMove!: (e: MouseEvent) => void;

    async init(canvas: HTMLCanvasElement, config: GameConfig): Promise<void> {
        this.worldSize = Number(config.world_size) || 10000;
        this.maxSpeed = Number(config.max_speed) || 100;
        this.rotationSpeed = Number(config.rotation_speed) || 1.5;

        // Input Setup
        canvas.style.cursor = 'none'; // Lock cursor style
        this.boundMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            // Normalize to -1 to 1
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            this.mouseX = (x * 2) - 1;
            this.mouseY = (y * 2) - 1;
        };
        window.addEventListener('mousemove', this.boundMouseMove);

        if (import.meta.env.DEV) {
            console.log('[SkyAce] Init', { worldSize: this.worldSize, maxSpeed: this.maxSpeed });
        }

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            logarithmicDepthBuffer: true // Better for large distances
        });
        this.renderer.setSize(canvas.width, canvas.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.00005); // Reduced fog for visibility

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, this.worldSize * 2);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        sunLight.position.set(500, 1000, 500);
        sunLight.castShadow = true;
        // Optimize shadow map for large world
        sunLight.shadow.camera.top = 200;
        sunLight.shadow.camera.bottom = -200;
        sunLight.shadow.camera.left = -200;
        sunLight.shadow.camera.right = 200;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 2000;
        this.scene.add(sunLight);

        // Setup
        this.createTerrain();
        this.createPlane();
        this.createClouds();
        this.createTargets();

        this.reset();
    }

    private reset(): void {
        this.speed = 0;
        this.score = 0;
        this.time = 0;
        this.gameOver = false;
        this.pitch = 0;
        this.roll = 0;
        this.yaw = 0;

        this.planeGroup.position.set(0, 400, 0);
        this.planeGroup.rotation.set(0, 0, 0);
    }

    private createTerrain(): void {
        // High resolution for "Gunship" quality
        const segments = 256;
        const geo = new THREE.PlaneGeometry(this.worldSize, this.worldSize, segments, segments);

        const count = geo.attributes.position.count;
        const colors: number[] = [];

        // Add some noise/hills to terrain
        const posAttr = geo.attributes.position;
        for (let i = 0; i < count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);

            const z = this.getTerrainHeight(x, y);
            posAttr.setZ(i, z);

            // Height-based coloring
            // Ocean: < 10
            // Sand: 10 - 25
            // Grass: 25 - 150
            // Rock: 150 - 280
            // Snow: > 280

            let color = new THREE.Color();

            if (z < 15) {
                // Ocean/Beach gradient
                color.setHex(0x3498db);
            } else if (z < 35) {
                // Sand
                color.setHex(0xf1c40f);
            } else if (z < 180) {
                // Grass w/ variation
                const noise = Math.sin(x * 0.05) * Math.cos(y * 0.05);
                color.setHex(noise > 0 ? 0x27ae60 : 0x2ecc71);
            } else if (z < 320) {
                // Rock
                color.setHex(0x7f8c8d);
            } else {
                // Snow
                color.setHex(0xffffff);
            }

            colors.push(color.r, color.g, color.b);
        }

        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true // Low-poly look
        });

        this.terrain = new THREE.Mesh(geo, mat);
        this.terrain.rotation.x = -Math.PI / 2;
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);

        // Water Plane
        const waterGeo = new THREE.PlaneGeometry(this.worldSize, this.worldSize);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x2980b9,
            transparent: true,
            opacity: 0.6,
            roughness: 0.1,
            metalness: 0.5
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = 10; // Sea level
        this.scene.add(water);
    }

    /**
     * Multi-layered noise function for interesting terrain
     */
    private getTerrainHeight(x: number, y: number): number {
        // Base rolling hills
        let h = (Math.sin(x * 0.003) + Math.cos(y * 0.003)) * 60;

        // Mountains
        h += (Math.sin(x * 0.01) * Math.cos(y * 0.01)) * 80;

        // Detail
        h += (Math.sin(x * 0.03 + y * 0.02) * Math.cos(y * 0.03)) * 20;

        // Micro-detail
        h += Math.sin(x * 0.1) * Math.cos(y * 0.1) * 2;

        return Math.max(-50, h + 50); // Offset to keep most land above 0
    }

    private createPlane(): void {
        this.planeGroup = new THREE.Group();

        // Body
        const bodyGeo = new THREE.BoxGeometry(1, 1, 5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        this.planeGroup.add(body);

        // Wings
        const wingGeo = new THREE.BoxGeometry(8, 0.1, 1.5);
        const wing = new THREE.Mesh(wingGeo, bodyMat);
        wing.castShadow = true;
        this.planeGroup.add(wing);

        // Tail
        const tailGeo = new THREE.BoxGeometry(3, 0.1, 1);
        const tail = new THREE.Mesh(tailGeo, bodyMat);
        tail.position.z = 2;
        this.planeGroup.add(tail);

        const finGeo = new THREE.BoxGeometry(0.1, 1.5, 1);
        const fin = new THREE.Mesh(finGeo, bodyMat);
        fin.position.z = 2;
        fin.position.y = 0.7;
        this.planeGroup.add(fin);

        // Propeller
        const propGeo = new THREE.BoxGeometry(3, 0.2, 0.1);
        const propMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50 });
        const prop = new THREE.Mesh(propGeo, propMat);
        prop.position.z = -2.5;
        prop.name = 'propeller';
        this.planeGroup.add(prop);

        this.scene.add(this.planeGroup);
    }

    private createClouds(): void {
        const count = 400; // More clouds for big world
        const geo = new THREE.SphereGeometry(30, 8, 8);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.7,
            flatShading: true
        });

        for (let i = 0; i < count; i++) {
            const cloud = new THREE.Group();
            const numBlobs = 4 + Math.floor(Math.random() * 5);
            for (let j = 0; j < numBlobs; j++) {
                const blob = new THREE.Mesh(geo, mat);
                blob.position.x = (Math.random() - 0.5) * 60;
                blob.position.y = (Math.random() - 0.5) * 30;
                blob.position.z = (Math.random() - 0.5) * 60;
                blob.scale.setScalar(0.5 + Math.random());
                cloud.add(blob);
            }

            cloud.position.set(
                (Math.random() - 0.5) * this.worldSize,
                400 + Math.random() * 1200,
                (Math.random() - 0.5) * this.worldSize
            );
            this.scene.add(cloud);
            this.clouds.push(cloud);
        }
    }

    private createTargets(): void {
        const count = 50; // More targets
        const geo = new THREE.TorusGeometry(30, 2, 16, 100);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xf1c40f,
            emissive: 0xf1c40f,
            emissiveIntensity: 0.5
        });

        for (let i = 0; i < count; i++) {
            const target = new THREE.Mesh(geo, mat);
            this.respawnTarget(target);
            this.scene.add(target);
            this.targets.push(target);
        }
    }

    private respawnTarget(target: THREE.Mesh): void {
        target.position.set(
            (Math.random() - 0.5) * (this.worldSize * 0.8),
            200 + Math.random() * 800,
            (Math.random() - 0.5) * (this.worldSize * 0.8)
        );
        target.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    }

    update(dt: number, input: InputState): boolean {
        // Safety clamp for dt to prevent physics explosions on lag spikes
        const safeDt = Math.min(dt, 0.1);

        if (this.gameOver) {
            if (input.action) this.reset();
            return true;
        }

        this.time += safeDt;

        // --- CONTROLS ---
        /// Speed Control (Action Button)
        if (input.action) {
            this.speed = Math.min(this.maxSpeed, this.speed + this.accel * safeDt);
        } else {
            // Decelerate if not boosting
            this.speed = Math.max(0, this.speed - (this.accel * 0.5) * safeDt);
        }

        // Mouse Controls (Fly Mode)
        // Normalize mouse input (-1 to 1)
        const mousePitch = -this.mouseY * 1.5; // Invert Y for flight stick feel
        const mouseRoll = this.mouseX * 1.5;

        // Keyboard Overrides
        const keyPitch = (input.keys['KeyW'] || input.up) ? 1 : (input.keys['KeyS'] || input.down) ? -1 : 0;
        const keyRoll = (input.keys['KeyA'] || input.left) ? 1 : (input.keys['KeyD'] || input.right) ? -1 : 0;

        // Combine Inputs (Mouse + Keyboard)
        const targetPitch = THREE.MathUtils.clamp(mousePitch + keyPitch, -1, 1);
        const targetRoll = THREE.MathUtils.clamp(mouseRoll + keyRoll, -1, 1);

        // Smoothly interpolate to targets
        this.pitch = THREE.MathUtils.lerp(this.pitch, targetPitch, safeDt * 3.0);
        this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, safeDt * 3.0);

        // Gunship Physics: Banking causes turning (Yaw)
        const turnRate = this.roll * this.rotationSpeed;
        this.yaw += turnRate * safeDt;

        // Yaw from mouse x (optional assist)
        this.yaw -= this.mouseX * safeDt * 0.5;

        // Auto-leveling (Yaw stabilization is manual, but Roll/Pitch auto-return to 0 when no input is handled above by strict lerping to 0 if input is 0)
        // (The lerp logic above already handles auto-return if pitchInput/rollInput is 0)

        // --- PHYSICS & MOVEMENT ---
        // Apply rotations
        this.planeGroup.rotation.y = this.yaw;
        this.planeGroup.rotation.z = this.roll * 0.8;
        this.planeGroup.rotation.x = this.pitch * 0.5;

        // Move forward
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.planeGroup.quaternion);
        this.planeGroup.position.add(forward.multiplyScalar(this.speed * safeDt));

        // Propeller animation
        const prop = this.planeGroup.getObjectByName('propeller');
        if (prop) prop.rotation.z += (this.speed + 10) * safeDt * 0.5;

        // Bounds (Wrap around or Wall? Let's do Wall with pushback)
        const halfWorld = this.worldSize / 2;
        if (Math.abs(this.planeGroup.position.x) > halfWorld) {
            this.planeGroup.position.x = Math.sign(this.planeGroup.position.x) * halfWorld;
            this.yaw += Math.PI; // Turn back
        }
        if (Math.abs(this.planeGroup.position.z) > halfWorld) {
            this.planeGroup.position.z = Math.sign(this.planeGroup.position.z) * halfWorld;
            this.yaw += Math.PI; // Turn back
        }

        // Ground Collision
        // Simple height map collision approximation
        const groundHeight = (Math.sin(this.planeGroup.position.x * 0.005) + Math.cos(this.planeGroup.position.z * 0.005)) * 100
            + (Math.sin(this.planeGroup.position.x * 0.02) * Math.cos(this.planeGroup.position.z * 0.02)) * 20;

        if (this.planeGroup.position.y < groundHeight + 5) {
            this.gameOver = true;
            this.speed = 0;
        }

        // Ceiling
        if (this.planeGroup.position.y > 2000) this.planeGroup.position.y = 2000;

        // --- CAMERA ---
        // Smooth follow cam
        const relativeOffset = new THREE.Vector3(0, 8, 20);
        const cameraOffset = relativeOffset.applyMatrix4(this.planeGroup.matrixWorld);

        // Critical Fix: Clamp lerp factor
        const lerpFactor = Math.min(safeDt * 5, 1.0);
        this.camera.position.lerp(cameraOffset, lerpFactor);
        this.camera.lookAt(this.planeGroup.position);

        // --- TARGETS ---
        this.targets.forEach(target => {
            if (this.planeGroup.position.distanceTo(target.position) < 30) {
                this.score += 1000;
                this.respawnTarget(target);
            }
        });

        this.score += Math.floor(this.speed * safeDt * 0.1);

        return true;
    }

    render(): void {
        this.renderer.render(this.scene, this.camera);
    }

    getScore(): number {
        return this.score;
    }

    destroy(): void {
        window.removeEventListener('mousemove', this.boundMouseMove);
        this.renderer.dispose();
        this.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
    }
}
