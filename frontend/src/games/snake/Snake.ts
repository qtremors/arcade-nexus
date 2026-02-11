/**
 * Zen Snake - Minimalist Snake with Premium Aesthetics
 * 
 * Features:
 * - Soft gradient colors and glow effects
 * - Smooth segment animations
 * - Particle effects on food collection
 * - Calming visual feedback
 * - Premium UI/UX
 */
import type { Game2DInstance, GameConfig, InputState } from '../../sdk/GameSDK';

interface Point {
    x: number;
    y: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';

export class SnakeGame implements Game2DInstance {
    readonly type = '2d' as const;

    private ctx!: CanvasRenderingContext2D;
    private width = 0;
    private height = 0;

    // Grid
    private cellSize = 28;
    private cols = 0;
    private rows = 0;
    private gridOffsetX = 0;
    private gridOffsetY = 0;

    // Snake
    private snake: Point[] = [];
    private lastTail: Point | null = null;
    private direction: Direction = 'right';
    private nextDirection: Direction = 'right';

    // Food
    private food: Point = { x: 0, y: 0 };
    private foodPulse = 0;

    // Particles
    private particles: Particle[] = [];

    // Game state
    private score = 0;
    private gameOver = false;
    private moveTimer = 0;
    private moveInterval = 120; // ms per move

    // Colors - Zen palette
    private readonly colors = {
        bg1: '#0d1117',
        bg2: '#161b22',
        grid: 'rgba(88, 166, 255, 0.04)', // Even subtler grid
        snake: '#58a6ff',
        snakeHead: '#79c0ff',
        snakeGlow: 'rgba(88, 166, 255, 0.4)',
        food: '#f778ba',
        foodGlow: 'rgba(247, 120, 186, 0.5)',
        text: 'rgba(255, 255, 255, 0.9)',
        textDim: 'rgba(255, 255, 255, 0.4)',
    };

    init(canvas: HTMLCanvasElement, config?: GameConfig): void {
        this.ctx = canvas.getContext('2d')!;
        this.width = canvas.width;
        this.height = canvas.height;

        // Apply difficulty
        if (config?.difficulty) {
            switch (config.difficulty) {
                case 'easy': this.moveInterval = 150; break;
                case 'hard': this.moveInterval = 90; break;
                case 'normal': default: this.moveInterval = 120; break;
            }
        }

        // Calculate grid
        this.calculateGrid();
        this.startNewGame();
    }

    private calculateGrid(): void {
        // Use most of the screen
        const padding = 60;
        const availWidth = this.width - padding * 2;
        const availHeight = this.height - padding * 2;

        this.cols = Math.floor(availWidth / this.cellSize);
        this.rows = Math.floor(availHeight / this.cellSize);

        // Center the grid
        this.gridOffsetX = (this.width - this.cols * this.cellSize) / 2;
        this.gridOffsetY = (this.height - this.rows * this.cellSize) / 2;
    }

    private startNewGame(): void {
        const centerX = Math.floor(this.cols / 2);
        const centerY = Math.floor(this.rows / 2);

        this.snake = [
            { x: centerX, y: centerY },
            { x: centerX - 1, y: centerY },
            { x: centerX - 2, y: centerY },
        ];
        this.lastTail = { x: centerX - 3, y: centerY };

        this.direction = 'right';
        this.nextDirection = 'right';
        this.score = 0;
        this.gameOver = false;
        this.moveTimer = 0;
        this.particles = [];

        this.spawnFood();
    }

    private spawnFood(): void {
        let x: number, y: number;
        do {
            x = Math.floor(Math.random() * this.cols);
            y = Math.floor(Math.random() * this.rows);
        } while (this.snake.some(s => s.x === x && s.y === y));

        this.food = { x, y };
    }

    private spawnParticles(x: number, y: number): void {
        const screenX = this.gridOffsetX + x * this.cellSize + this.cellSize / 2;
        const screenY = this.gridOffsetY + y * this.cellSize + this.cellSize / 2;

        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
            const speed = 2 + Math.random() * 3;
            this.particles.push({
                x: screenX,
                y: screenY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                maxLife: 1,
                color: i % 2 === 0 ? this.colors.food : this.colors.snake,
                size: 3 + Math.random() * 4,
            });
        }
    }

    update(dt: number, input: InputState): boolean {
        if (this.gameOver) return false;

        // Handle input
        if (input.up && this.direction !== 'down') this.nextDirection = 'up';
        if (input.down && this.direction !== 'up') this.nextDirection = 'down';
        if (input.left && this.direction !== 'right') this.nextDirection = 'left';
        if (input.right && this.direction !== 'left') this.nextDirection = 'right';

        // Update food pulse
        this.foodPulse += dt * 0.005;

        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // gravity
            p.life -= dt / 1000;
            return p.life > 0;
        });

        // Move timer
        this.moveTimer += dt;
        if (this.moveTimer < this.moveInterval) return true;
        this.moveTimer = 0;

        // Apply direction
        this.direction = this.nextDirection;

        // Calculate new head position
        const head = { ...this.snake[0] };
        switch (this.direction) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }

        // Check wall collision
        if (head.x < 0 || head.x >= this.cols || head.y < 0 || head.y >= this.rows) {
            this.gameOver = true;
            return false;
        }

        // Check self collision
        if (this.snake.some(s => s.x === head.x && s.y === head.y)) {
            this.gameOver = true;
            return false;
        }

        // Add new head
        this.snake.unshift(head);

        // Check food
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.spawnParticles(this.food.x, this.food.y);
            this.spawnFood();
            // Speed up slightly
            this.moveInterval = Math.max(60, this.moveInterval - 2);
            // Don't remove tail (grow)
            // But we need to update lastTail for smooth lerp continuity if we didn't move it?
            // Actually if we grow, the "tail" stays put. So lastTail should equal current tail.
            this.lastTail = { ...this.snake[this.snake.length - 1] };
        } else {
            // Remove tail
            this.lastTail = this.snake.pop() || null;
        }

        return true;
    }

    render(): void {
        const { ctx, width, height } = this;

        // Background gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, this.colors.bg1);
        bgGrad.addColorStop(1, this.colors.bg2);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Grid
        this.renderGrid();

        // Food with glow
        this.renderFood();

        // Snake with glow
        this.renderSnake();

        // Particles
        this.renderParticles();

        // Score
        this.renderScore();
    }

    private renderGrid(): void {
        const { ctx } = this;

        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x <= this.cols; x++) {
            ctx.beginPath();
            ctx.moveTo(this.gridOffsetX + x * this.cellSize, this.gridOffsetY);
            ctx.lineTo(this.gridOffsetX + x * this.cellSize, this.gridOffsetY + this.rows * this.cellSize);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= this.rows; y++) {
            ctx.beginPath();
            ctx.moveTo(this.gridOffsetX, this.gridOffsetY + y * this.cellSize);
            ctx.lineTo(this.gridOffsetX + this.cols * this.cellSize, this.gridOffsetY + y * this.cellSize);
            ctx.stroke();
        }

        // Border around play area
        ctx.strokeStyle = 'rgba(88, 166, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            this.gridOffsetX,
            this.gridOffsetY,
            this.cols * this.cellSize,
            this.rows * this.cellSize
        );
    }

    private renderFood(): void {
        const { ctx } = this;
        const x = this.gridOffsetX + this.food.x * this.cellSize + this.cellSize / 2;
        const y = this.gridOffsetY + this.food.y * this.cellSize + this.cellSize / 2;
        const pulse = 1 + Math.sin(this.foodPulse) * 0.15;
        const size = (this.cellSize / 2 - 4) * pulse;

        // Glow
        ctx.shadowColor = this.colors.foodGlow;
        ctx.shadowBlur = 20;

        // Food
        ctx.fillStyle = this.colors.food;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(x - size * 0.2, y - size * 0.2, size * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    private renderSnake(): void {
        const { ctx } = this;

        // Linear Interpolation factor (0 to 1)
        const alpha = Math.min(1, this.moveTimer / this.moveInterval);

        // Draw segments
        for (let i = 0; i < this.snake.length; i++) {
            const current = this.snake[i];
            let next = this.snake[i + 1];

            // If it's the last segment, interpolate towards lastTail
            if (!next) {
                if (this.lastTail) next = this.lastTail;
                else next = current; // Should't happen ideally
            }

            // Lerp between next (previous position) and current (new position)
            // Visual Head moves from snake[1] to snake[0]
            // Visual Segment i moves from snake[i+1] to snake[i]

            const lx = next.x + (current.x - next.x) * alpha;
            const ly = next.y + (current.y - next.y) * alpha;

            const x = this.gridOffsetX + lx * this.cellSize;
            const y = this.gridOffsetY + ly * this.cellSize;
            const isHead = i === 0;

            // Progress for gradient (0 = tail, 1 = head)
            const progress = (this.snake.length - i) / this.snake.length;

            // Size varies slightly
            const padding = isHead ? 2 : 3;
            const size = this.cellSize - padding * 2;
            const radius = isHead ? size / 2 : size / 3;

            // Glow for head
            if (isHead) {
                ctx.shadowColor = this.colors.snakeGlow;
                ctx.shadowBlur = 15;
            }

            // Color gradient from head to tail
            const opacity = 0.4 + progress * 0.6;
            ctx.fillStyle = isHead
                ? this.colors.snakeHead
                : `rgba(88, 166, 255, ${opacity})`;

            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x + padding, y + padding, size, size, radius);
            } else {
                ctx.fillRect(x + padding, y + padding, size, size); // Fallback
            }
            ctx.fill();

            ctx.shadowBlur = 0;

            // Head eyes (interpolated)
            if (isHead) {
                const hx = x + this.cellSize / 2;
                const hy = y + this.cellSize / 2;

                ctx.fillStyle = '#fff';
                const eyeOffset = 4;
                const eyeSize = 3;

                // Determine eye direction based on movement
                // Use current direction for simplicity, or interpolate angle
                let ex1 = 0, ey1 = 0, ex2 = 0, ey2 = 0;
                switch (this.direction) {
                    case 'right':
                        ex1 = hx + eyeOffset; ey1 = hy - 3; ex2 = hx + eyeOffset; ey2 = hy + 3; break;
                    case 'left':
                        ex1 = hx - eyeOffset; ey1 = hy - 3; ex2 = hx - eyeOffset; ey2 = hy + 3; break;
                    case 'up':
                        ex1 = hx - 3; ey1 = hy - eyeOffset; ex2 = hx + 3; ey2 = hy - eyeOffset; break;
                    case 'down':
                        ex1 = hx - 3; ey1 = hy + eyeOffset; ex2 = hx + 3; ey2 = hy + eyeOffset; break;
                }

                ctx.beginPath();
                ctx.arc(ex1, ey1, eyeSize, 0, Math.PI * 2);
                ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    private renderParticles(): void {
        const { ctx } = this;
        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    private renderScore(): void {
        const { ctx, width } = this;

        // Score top center
        ctx.fillStyle = this.colors.text;
        ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.score}`, width / 2, 45);

        // Length indicator
        ctx.fillStyle = this.colors.textDim;
        ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(`LENGTH: ${this.snake.length}`, width / 2, 68);
    }

    getScore(): number { return this.score; }
    getState(): Record<string, unknown> { return { score: this.score, length: this.snake.length }; }
    setState(state: Record<string, unknown>): void { if (typeof state.score === 'number') this.score = state.score; }
    onPause(): void { }
    onResume(): void { }
    destroy(): void { }
}
