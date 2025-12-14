/**
 * Stellar Drift - Enhanced 3D Space Runner
 *
 * Features:
 * - Dynamic Chase Camera (Third-person)
 * - Volume-based Star Field & Nebula effects
 * - Smooth physics-based controls
 * - Energy management & Speed boosting
 */
import type { Game3DInstance, GameConfig, InputState } from '../../sdk/GameSDK';
import * as THREE from 'three';

export class SpaceRunnerGame implements Game3DInstance {
    readonly type = '3d' as const;

    private renderer!: THREE.WebGLRenderer;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private shipGroup!: THREE.Group;
    private shipMesh!: THREE.Mesh;

    // Environment
    private starPoints!: THREE.Points;
    private nebulaParticles!: THREE.Points;
    private environmentSpeed = 0;

    // Game Objects
    private obstacles: THREE.Mesh[] = [];
    private pickups: THREE.Mesh[] = [];

    // State
    private score = 0;
    private energy = 100;
    private speed = 0;
    private maxSpeed = 4.0;
    private boostSpeed = 6.0;
    private isBoosting = false;
    private gameOver = false;
    private time = 0;
    private gracePeriod = 2.0; // 2 seconds invulnerability at start

    // Ship physics
    private shipPosition = new THREE.Vector2();
    private shipVelocity = new THREE.Vector2();
    private readonly limits = { x: 30, y: 18 };

    // Camera
    private cameraOffset = new THREE.Vector3(0, 6, 20);
    private cameraLookAt = new THREE.Vector3(0, 2, -10);

    private reset(): void {
        this.score = 0;
        this.energy = 100;
        this.speed = 0;
        this.gameOver = false;
        this.gracePeriod = 2.0;
        this.shipPosition.set(0, 0);
        this.shipVelocity.set(0, 0);
        this.shipGroup.rotation.set(0, 0, 0);

        // Reset objects
        this.obstacles.forEach(o => o.position.z = -1000 - Math.random() * 2000);
        this.pickups.forEach(p => p.position.z = -500 - Math.random() * 2000);
    }

    update(dt: number, input: InputState): boolean {
        if (this.gameOver || !this.renderer || !this.scene || !this.camera) return false;

        this.time += dt;
        if (this.gracePeriod > 0) this.gracePeriod -= dt;

        // --- CONTROLS ---
        const accel = 80;
        const decel = 0.92;

        if (input.left) this.shipVelocity.x -= accel * dt;
        if (input.right) this.shipVelocity.x += accel * dt;
        if (input.up) this.shipVelocity.y += accel * dt;
        if (input.down) this.shipVelocity.y -= accel * dt;

        // Boost
        this.isBoosting = input.action && this.energy > 0;
        const targetSpeed = this.isBoosting ? this.boostSpeed : this.maxSpeed;
        this.speed += (targetSpeed - this.speed) * dt * 2;

        if (this.isBoosting) {
            this.energy -= dt * 30;
            if (this.energy < 0) this.energy = 0;
        } else {
            this.energy = Math.min(100, this.energy + dt * 5);
        }

        // Apply velocity
        this.shipVelocity.multiplyScalar(decel);
        this.shipPosition.add(this.shipVelocity.clone().multiplyScalar(dt));

        // Clamp to limits
        this.shipPosition.x = THREE.MathUtils.clamp(this.shipPosition.x, -this.limits.x, this.limits.x);
        this.shipPosition.y = THREE.MathUtils.clamp(this.shipPosition.y, -this.limits.y, this.limits.y);

        // Update ship group position
        this.shipGroup.position.x = this.shipPosition.x;
        this.shipGroup.position.y = this.shipPosition.y;

        // Ship tilt based on velocity
        this.shipGroup.rotation.z = -this.shipVelocity.x * 0.02;
        this.shipGroup.rotation.x = this.shipVelocity.y * 0.015;

        // Environment speed based on ship speed
        this.environmentSpeed = 50 + this.speed * 30;

        // Score
        this.score += dt * this.environmentSpeed * 0.5;

        // --- OBJECT MANAGEMENT ---
        this.updateEnvironment(dt);
        this.handleObstacles(dt);
        this.handlePickups(dt);

        // --- CAMERA ---
        const targetCamPos = this.shipGroup.position.clone().add(this.cameraOffset);
        this.camera.position.lerp(targetCamPos, dt * 5);
        this.camera.lookAt(this.shipGroup.position.clone().add(this.cameraLookAt));

        return true;
    }

    private handleObstacles(dt: number): void {
        const playerBox = new THREE.Box3().setFromObject(this.shipMesh);
        // Shrink hitbox slightly for forgiveness
        playerBox.expandByScalar(-0.5);

        this.obstacles.forEach(mesh => {
            mesh.position.z += this.environmentSpeed * dt;
            mesh.rotation.x += dt;
            mesh.rotation.y += dt;

            // Collision - only if grace period is over
            if (this.gracePeriod <= 0) {
                const obsBox = new THREE.Box3().setFromObject(mesh);
                if (playerBox.intersectsBox(obsBox)) {
                    this.gameOver = true;
                    // Simple impact effect could go here
                }
            }

            // Respawn
            if (mesh.position.z > 50) {
                mesh.position.z = -800 - Math.random() * 1000;
                mesh.position.x = (Math.random() - 0.5) * (this.limits.x * 2.5);
                mesh.position.y = (Math.random() - 0.5) * (this.limits.y * 2.5);

                // Random scale
                const s = 1 + Math.random() * 2;
                mesh.scale.set(s, s, s);
            }
        });
    }

    init(canvas: HTMLCanvasElement, _config?: GameConfig): void {
        const width = canvas.width;
        const height = canvas.height;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x020205); // Deep space blue-black
        this.scene.fog = new THREE.FogExp2(0x020205, 0.0015);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfff0dd, 1.5);
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        this.scene.add(sunLight);

        // Setup
        this.createEnvironment();
        this.createShip();
        this.createObstacles();
        this.createPickups();
        this.reset();

        // Initial render to ensure screen isn't blank before loop starts
        this.camera.position.copy(this.shipGroup.position).add(this.cameraOffset);
        this.camera.lookAt(this.shipGroup.position.clone().add(this.cameraLookAt));
        this.renderer.render(this.scene, this.camera);
    }

    private createEnvironment(): void {
        // 1. DENSE STAR FIELD
        const starCount = 8000;
        const starGeo = new THREE.BufferGeometry();
        const starPos = new Float32Array(starCount * 3);
        const starCols = new Float32Array(starCount * 3);

        const colorPalette = [
            new THREE.Color(0xffffff), // White
            new THREE.Color(0xaaddff), // Blue-white
            new THREE.Color(0xffddaa), // Orange-white
        ];

        for (let i = 0; i < starCount; i++) {
            const x = (Math.random() - 0.5) * 600;
            const y = (Math.random() - 0.5) * 600;
            const z = (Math.random() - 0.5) * 2000 - 500;

            starPos[i * 3] = x;
            starPos[i * 3 + 1] = y;
            starPos[i * 3 + 2] = z;

            const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            starCols[i * 3] = col.r;
            starCols[i * 3 + 1] = col.g;
            starCols[i * 3 + 2] = col.b;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(starCols, 3));

        const starMat = new THREE.PointsMaterial({
            size: 0.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        this.starPoints = new THREE.Points(starGeo, starMat);
        this.scene.add(this.starPoints);

        // 2. NEBULA PARTICLES (Simple volumetric feel)
        const nebulaCount = 600;
        const nebulaGeo = new THREE.BufferGeometry();
        const nebulaPos = new Float32Array(nebulaCount * 3);
        const nebulaSizes = new Float32Array(nebulaCount);

        for (let i = 0; i < nebulaCount; i++) {
            nebulaPos[i * 3] = (Math.random() - 0.5) * 400;
            nebulaPos[i * 3 + 1] = (Math.random() - 0.5) * 300;
            nebulaPos[i * 3 + 2] = (Math.random() - 0.5) * 1500 - 500;
            nebulaSizes[i] = Math.random() * 40 + 10;
        }

        nebulaGeo.setAttribute('position', new THREE.BufferAttribute(nebulaPos, 3));
        nebulaGeo.setAttribute('size', new THREE.BufferAttribute(nebulaSizes, 1));

        const nebulaMat = new THREE.PointsMaterial({
            color: 0x8844ff,
            size: 1, // Scaled by attribute
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        // Note: sizeAttenuation doesn't accept buffer attributes directly in basic PointsMaterial without shader mod, 
        // but let's stick to standard for stability. We'll use a constant size or loop to create sprites if needed.
        // Actually, let's keep it simple: just Points.
        nebulaMat.size = 20;

        this.nebulaParticles = new THREE.Points(nebulaGeo, nebulaMat);
        this.scene.add(this.nebulaParticles);
    }

    private createShip(): void {
        this.shipGroup = new THREE.Group();

        // Sleek hull
        const hullGeo = new THREE.ConeGeometry(1, 4, 8);
        hullGeo.rotateX(Math.PI / 2); // Point forward
        const hullMat = new THREE.MeshStandardMaterial({
            color: 0x00ddee,
            roughness: 0.2,
            metalness: 0.8,
            emissive: 0x004455,
            emissiveIntensity: 0.2
        });
        this.shipMesh = new THREE.Mesh(hullGeo, hullMat);
        this.shipMesh.castShadow = true;
        this.shipGroup.add(this.shipMesh);

        // Engines
        const engineGeo = new THREE.CylinderGeometry(0.3, 0.1, 1.5, 8);
        engineGeo.rotateX(Math.PI / 2);
        const engineMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

        const leftEng = new THREE.Mesh(engineGeo, engineMat);
        leftEng.position.set(-1.2, 0, 1);
        this.shipGroup.add(leftEng);

        const rightEng = new THREE.Mesh(engineGeo, engineMat);
        rightEng.position.set(1.2, 0, 1);
        this.shipGroup.add(rightEng);

        // Engine Glows
        const glowGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

        const lGlow = new THREE.Mesh(glowGeo, glowMat);
        lGlow.position.z = 0.8;
        leftEng.add(lGlow);

        const rGlow = new THREE.Mesh(glowGeo, glowMat);
        rGlow.position.z = 0.8;
        rightEng.add(rGlow);

        // Wings
        const wingGeo = new THREE.BufferGeometry();
        const wingVerts = new Float32Array([
            0, 0, 1, 2.5, -0.5, 2, 0, 0, -1,
            0, 0, 1, -2.5, -0.5, 2, 0, 0, -1
        ]);
        wingGeo.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x0088aa,
            side: THREE.DoubleSide,
            metalness: 0.6
        });
        const wings = new THREE.Mesh(wingGeo, wingMat);
        this.shipGroup.add(wings);

        this.scene.add(this.shipGroup);
    }

    private createObstacles(): void {
        const geo = new THREE.DodecahedronGeometry(2);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x885555,
            roughness: 0.9,
            flatShading: true
        });

        for (let i = 0; i < 40; i++) {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(0, 0, -10000); // Hide initially
            this.scene.add(mesh);
            this.obstacles.push(mesh);
        }
    }

    private createPickups(): void {
        // Energy crystals
        const geo = new THREE.OctahedronGeometry(1);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffee00,
            wireframe: true
        });
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const coreGeo = new THREE.OctahedronGeometry(0.6);

        for (let i = 0; i < 15; i++) {
            const group = new THREE.Group() as any; // Cast for TS
            const wire = new THREE.Mesh(geo, mat);
            const core = new THREE.Mesh(coreGeo, coreMat);
            group.add(wire);
            group.add(core);

            group.userData = { type: 'energy' };
            group.position.set(0, 0, -10000);

            this.scene.add(group);
            this.pickups.push(group as THREE.Mesh); // Treat group as mesh for array
        }
    }





    private updateEnvironment(dt: number): void {
        // Move stars
        const positions = this.starPoints.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 2] += this.environmentSpeed * dt * 2; // Stars move fast
            if (positions[i + 2] > 50) {
                positions[i + 2] = -1500; // Reset far back
                positions[i] = (Math.random() - 0.5) * 600;
                positions[i + 1] = (Math.random() - 0.5) * 600;
            }
        }
        this.starPoints.geometry.attributes.position.needsUpdate = true;

        // Rotate Nebula
        this.nebulaParticles.rotation.z += dt * 0.05;
        this.nebulaParticles.position.z += this.environmentSpeed * dt * 0.5;
        if (this.nebulaParticles.position.z > 500) this.nebulaParticles.position.z = -500;
    }



    private handlePickups(dt: number): void {
        this.pickups.forEach(mesh => {
            mesh.position.z += this.environmentSpeed * dt;
            // Spin
            mesh.rotation.y += dt * 3;

            // Check distance
            if (mesh.position.distanceTo(this.shipGroup.position) < 3.5) {
                // Collect!
                this.score += 500;
                this.energy = Math.min(100, this.energy + 25);

                // Reset far away
                mesh.position.z = -1000 - Math.random() * 2000;
                mesh.position.x = (Math.random() - 0.5) * (this.limits.x * 2);
                mesh.position.y = (Math.random() - 0.5) * (this.limits.y * 2);
            }

            // Respawn if passed
            if (mesh.position.z > 50) {
                mesh.position.z = -1000 - Math.random() * 2000;
                mesh.position.x = (Math.random() - 0.5) * (this.limits.x * 2);
                mesh.position.y = (Math.random() - 0.5) * (this.limits.y * 2);
            }
        });
    }

    render(): void {
        this.renderer.render(this.scene, this.camera);
    }

    // --- INTERFACE IMPLEMENTATION ---
    getScore(): number { return Math.floor(this.score); }

    // Add simple HUD drawing on top of 3D, if SDK supported 2D overlay context, 
    // but here we just rely on 3D or the parent GameCanvas.
    // For "immersive" stats, we could specific methods to draw to a 2D canvas if provided.

    destroy(): void {
        this.renderer.dispose();
        // Traverse and dispose geometries/materials
        this.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            }
        });
    }
}
