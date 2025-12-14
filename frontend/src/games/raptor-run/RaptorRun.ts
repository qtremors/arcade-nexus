/**
 * Raptor Run - Endless Runner Game
 * Score based on distance, jump over obstacles
 */
import type { Game2DInstance, GameConfig, InputState } from '../../sdk/GameSDK';

interface Obstacle {
    x: number;
    width: number;
    height: number;
    type: 'cactus' | 'rock' | 'bird';
    y: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    size: number;
}

export class RaptorRunGame implements Game2DInstance {
    readonly type = '2d' as const;

    private ctx!: CanvasRenderingContext2D;
    private width = 0;
    private height = 0;

    // Physics
    private readonly GRAVITY = 2500;
    private readonly JUMP_FORCE = 850;
    private readonly INITIAL_SPEED = 400;
    private readonly MAX_SPEED = 1000;

    // Raptor state
    private raptorX = 80;
    private raptorY = 0;
    private raptorVelocity = 0;
    private readonly raptorWidth = 50;
    private readonly raptorHeight = 60;
    private groundY = 0;
    private isJumping = false;
    private isDucking = false;
    private legFrame = 0;
    private legTimer = 0;

    // Game state
    private obstacles: Obstacle[] = [];
    private particles: Particle[] = [];
    private gameSpeed = this.INITIAL_SPEED;
    private score = 0;
    private distance = 0;
    private gameOver = false;
    private dayTime = 0;
    private spawnTimer = 0;
    private spawnInterval = 1500;

    init(canvas: HTMLCanvasElement, _config?: GameConfig): void {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get 2D context');
        this.ctx = context;
        this.width = canvas.width;
        this.height = canvas.height;
        this.groundY = this.height * 0.8;
        this.reset();
    }

    private reset(): void {
        this.raptorY = this.groundY - this.raptorHeight;
        this.raptorVelocity = 0;
        this.isJumping = false;
        this.isDucking = false;
        this.obstacles = [];
        this.particles = [];
        this.gameSpeed = this.INITIAL_SPEED;
        this.score = 0;
        this.distance = 0;
        this.gameOver = false;
        this.spawnTimer = 0;
        this.spawnInterval = 1500;
    }

    update(deltaTime: number, input: InputState): boolean {
        if (this.gameOver) return false;

        const dt = deltaTime / 1000;
        this.dayTime = (this.dayTime + dt * 0.017) % 1;

        // Jump
        if ((input.up || input.action) && !this.isJumping) {
            this.raptorVelocity = -this.JUMP_FORCE;
            this.isJumping = true;
            this.spawnDust(3, this.raptorX + this.raptorWidth / 2, this.groundY);
        }

        // Fast fall
        if (input.down && this.isJumping) {
            this.raptorVelocity += this.GRAVITY * dt;
        }

        this.isDucking = input.down && !this.isJumping;

        // Physics
        this.raptorVelocity += this.GRAVITY * dt;
        this.raptorY += this.raptorVelocity * dt;

        const groundLevel = this.groundY - this.raptorHeight;
        if (this.raptorY >= groundLevel) {
            this.raptorY = groundLevel;
            if (this.isJumping) {
                this.spawnDust(2, this.raptorX + this.raptorWidth / 2, this.groundY);
            }
            this.raptorVelocity = 0;
            this.isJumping = false;
        }

        // Leg animation
        if (!this.isJumping) {
            this.legTimer += dt;
            if (this.legTimer > 0.08) {
                this.legFrame = 1 - this.legFrame;
                this.legTimer = 0;
            }
        }

        // Distance and score
        const moveDist = this.gameSpeed * dt;
        this.distance += moveDist;
        this.score = Math.floor(this.distance / 10);

        // Spawn obstacles
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnObstacle();
            this.spawnTimer = 0;
            this.spawnInterval = Math.max(800, 1500 - this.score * 2);
        }

        // Update obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.x -= moveDist;
            if (obs.x < -100) {
                this.obstacles.splice(i, 1);
                continue;
            }
            if (this.checkCollision(obs)) {
                this.gameOver = true;
                this.spawnDust(15, this.raptorX + this.raptorWidth / 2, this.raptorY + this.raptorHeight / 2);
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 400 * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        this.gameSpeed = Math.min(this.MAX_SPEED, this.INITIAL_SPEED + this.score * 0.5);
        return true;
    }

    private checkCollision(obs: Obstacle): boolean {
        const rX = this.raptorX + 10;
        const rY = this.isDucking ? this.raptorY + this.raptorHeight / 2 : this.raptorY + 5;
        const rW = this.raptorWidth - 20;
        const rH = this.isDucking ? this.raptorHeight / 2 - 5 : this.raptorHeight - 10;
        const oX = obs.x + 5;
        const oY = obs.y + 5;
        const oW = obs.width - 10;
        const oH = obs.height - 10;
        return rX < oX + oW && rX + rW > oX && rY < oY + oH && rY + rH > oY;
    }

    private spawnObstacle(): void {
        const types: Obstacle['type'][] = ['cactus', 'cactus', 'rock'];
        if (this.score > 50) types.push('bird', 'bird');

        const type = types[Math.floor(Math.random() * types.length)];
        let width = 30, height = 50, y = this.groundY;

        if (type === 'cactus') {
            width = 25 + Math.random() * 15;
            height = 50 + Math.random() * 25;
            y = this.groundY - height;
        } else if (type === 'rock') {
            width = 35 + Math.random() * 20;
            height = 25 + Math.random() * 15;
            y = this.groundY - height;
        } else if (type === 'bird') {
            width = 40;
            height = 25;
            const heights = [30, 60, 90];
            y = this.groundY - heights[Math.floor(Math.random() * heights.length)] - height;
        }
        this.obstacles.push({ x: this.width + 50, width, height, type, y });
    }

    private spawnDust(count: number, x: number, y: number): void {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y,
                vx: (Math.random() - 0.5) * 100 - this.gameSpeed * 0.3,
                vy: -50 - Math.random() * 80,
                life: 0.3 + Math.random() * 0.3,
                size: 2 + Math.random() * 3
            });
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        const isNight = this.dayTime > 0.5;
        const skyTop = isNight ? '#0f0c29' : '#4facfe';
        const skyBottom = isNight ? '#203a43' : '#00f2fe';
        const groundColor = isNight ? '#1a1a2e' : '#8b7355';

        // Sky
        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, skyTop);
        grad.addColorStop(1, skyBottom);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Sun/Moon
        const celestialY = 80 + Math.sin(this.dayTime * Math.PI * 2) * 40;
        ctx.fillStyle = isNight ? '#fdfeba' : '#ffeb3b';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(this.width - 100, celestialY, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Ground
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);
        ctx.strokeStyle = isNight ? '#333' : '#6b5a47';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, this.groundY);
        ctx.lineTo(this.width, this.groundY);
        ctx.stroke();

        // Particles
        ctx.fillStyle = 'rgba(200, 180, 150, 0.7)';
        for (const p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.life * 2);
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1;

        // Obstacles
        for (const obs of this.obstacles) this.drawObstacle(ctx, obs);

        // Raptor
        this.drawRaptor(ctx);

        // Score
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${this.getScore()}`, this.width - 30, 50);

        // Game over
        if (this.gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#ff6b6b';
            ctx.font = 'bold 48px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('CRASHED!', this.width / 2, this.height / 2 - 30);
            ctx.fillStyle = '#fff';
            ctx.font = '24px Inter, sans-serif';
            ctx.fillText(`Score: ${this.getScore()}`, this.width / 2, this.height / 2 + 20);
        }
    }

    private drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
        if (obs.type === 'cactus') {
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(obs.x + 3, obs.y + 3, obs.width - 6, obs.height - 6);
        } else if (obs.type === 'rock') {
            ctx.fillStyle = '#7f8c8d';
            ctx.beginPath();
            ctx.moveTo(obs.x, obs.y + obs.height);
            ctx.lineTo(obs.x + obs.width / 2, obs.y);
            ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
            ctx.closePath();
            ctx.fill();
        } else if (obs.type === 'bird') {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 3, 0, 0, Math.PI * 2);
            ctx.fill();
            const flap = Math.sin(this.distance * 0.05) * 10;
            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(obs.x + 10, obs.y + obs.height / 2);
            ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height / 2 - flap);
            ctx.lineTo(obs.x + obs.width - 10, obs.y + obs.height / 2);
            ctx.stroke();
        }
    }

    private drawRaptor(ctx: CanvasRenderingContext2D): void {
        const x = this.raptorX;
        const y = this.isDucking ? this.raptorY + this.raptorHeight / 2 : this.raptorY;
        const h = this.isDucking ? this.raptorHeight / 2 : this.raptorHeight;
        const w = this.raptorWidth;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, this.groundY, w / 2, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = '#ff7675';
        ctx.beginPath();
        ctx.roundRect(x + w * 0.3, y, w * 0.7, h * 0.6, 8);
        ctx.fill();

        // Head
        ctx.beginPath();
        ctx.roundRect(x + w * 0.5, y - h * 0.1, w * 0.5, h * 0.35, 5);
        ctx.fill();

        // Legs
        if (!this.isJumping) {
            ctx.strokeStyle = '#d63031';
            ctx.lineWidth = 4;
            const offset = this.legFrame === 0 ? 5 : -5;
            ctx.beginPath();
            ctx.moveTo(x + w * 0.4, y + h * 0.6);
            ctx.lineTo(x + w * 0.4 + offset, this.groundY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + w * 0.7, y + h * 0.6);
            ctx.lineTo(x + w * 0.7 - offset, this.groundY);
            ctx.stroke();
        }

        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x + w * 0.8, y + h * 0.1, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x + w * 0.82, y + h * 0.1, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    getScore(): number {
        return Math.max(0, Math.floor(this.score));
    }

    getState(): Record<string, unknown> {
        return { score: this.score, distance: this.distance };
    }

    setState(state: Record<string, unknown>): void {
        if (typeof state.score === 'number') this.score = state.score;
        if (typeof state.distance === 'number') this.distance = state.distance;
    }

    onPause(): void { }
    onResume(): void { }
    destroy(): void { }
}
