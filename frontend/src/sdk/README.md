# Arcade Nexus Game SDK

> Build games for the Arcade Nexus platform using TypeScript and Canvas 2D.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Your Game  │───▶│  Game Engine │───▶│   Canvas 2D  │  │
│  │  (SnakeGame) │    │   (SDK)      │    │  (Rendering) │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                               │
│         ▼                   ▼                               │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │ InputManager │    │  GameCanvas  │◀── React Component    │
│  │  (Keyboard)  │    │   (UI/HUD)   │                      │
│  └──────────────┘    └──────────────┘                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ API Calls
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  High Scores │    │  Save States │    │ Achievements │  │
│  │   /stats/*   │    │   /saves/*   │    │ /achieve/*   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                              │                               │
│                              ▼                               │
│                     ┌──────────────┐                        │
│                     │    SQLite    │                        │
│                     │   Database   │                        │
│                     └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

**All game data is stored on the backend.** You can switch browsers and your progress persists.

---

## Quick Start: Building a Game

### Step 1: Create Your Game Class

```typescript
// src/games/MyGame.ts
import type { GameInstance, GameConfig, InputState } from '../sdk';

export class MyGame implements GameInstance {
    private canvas!: HTMLCanvasElement;
    private score = 0;
    private gameOver = false;

    async init(canvas: HTMLCanvasElement, config: GameConfig): Promise<void> {
        this.canvas = canvas;
        // Initialize your game state here
    }

    update(deltaTime: number, input: InputState): boolean {
        if (this.gameOver) {
            // Check for restart input
            if (input.action) {
                this.restart();
            }
            return true; // Keep running for restart
        }

        // Game logic here
        // Return false to trigger game over
        return true;
    }

    render(ctx: CanvasRenderingContext2D): void {
        // Clear canvas
        ctx.fillStyle = '#0f1419';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw your game
        // ...

        // Draw score
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px monospace';
        ctx.fillText(`Score: ${this.score}`, 10, 30);
    }

    getScore(): number {
        return this.score;
    }

    private restart(): void {
        this.score = 0;
        this.gameOver = false;
    }
}
```

### Step 2: Register Your Game

```typescript
// src/games/index.ts
import { registerGame } from '../sdk';
import { MyGame } from './MyGame';

registerGame('my-game', () => new MyGame());
```

### Step 3: Add to Backend Database

Run the seed script or add via API:
```bash
cd backend
uv run python -c "
from app.seed import seed_games
import asyncio
asyncio.run(seed_games())
"
```

---

## GameInstance Interface

Every game must implement this interface:

```typescript
interface GameInstance {
    // REQUIRED
    init(canvas: HTMLCanvasElement, config: GameConfig): void | Promise<void>;
    update(deltaTime: number, input: InputState): boolean;
    render(ctx: CanvasRenderingContext2D): void;

    // OPTIONAL - Lifecycle
    onPause?(): void;
    onResume?(): void;
    destroy?(): void;

    // OPTIONAL - Persistence
    getState?(): Record<string, unknown>;
    setState?(state: Record<string, unknown>): void;
    getScore?(): number;
}
```

### Method Details

| Method | When Called | Purpose |
|--------|-------------|---------|
| `init` | Once at game load | Initialize state, load assets |
| `update` | Every frame (~60fps) | Game logic. Return `false` = game over |
| `render` | Every frame after update | Draw to canvas |
| `onPause` | When player pauses | Stop sounds, show pause state |
| `onResume` | When player unpauses | Resume sounds/timers |
| `destroy` | When leaving game | Cleanup resources |
| `getScore` | On game over | Submit high score to backend |
| `getState` | When saving | Return serializable state |
| `setState` | When loading | Restore saved state |

---

## InputState Reference

The SDK provides normalized input state:

```typescript
interface InputState {
    // Directional (Arrow keys OR WASD)
    up: boolean;       // ↑ or W
    down: boolean;     // ↓ or S
    left: boolean;     // ← or A
    right: boolean;    // → or D

    // Action buttons
    action: boolean;   // Space or Enter
    cancel: boolean;   // Escape
    pause: boolean;    // P or Escape

    // Raw keys for custom bindings
    keys: Record<string, boolean>;  // e.g., keys['KeyZ']
}
```

### Example: Handling Input

```typescript
update(deltaTime: number, input: InputState): boolean {
    // Movement
    if (input.up) this.player.y -= this.speed * deltaTime;
    if (input.down) this.player.y += this.speed * deltaTime;
    if (input.left) this.player.x -= this.speed * deltaTime;
    if (input.right) this.player.x += this.speed * deltaTime;

    // Action (fire, jump, etc.)
    if (input.action && this.canShoot) {
        this.shoot();
    }

    // Custom key binding
    if (input.keys['KeyZ']) {
        this.useSpecialAbility();
    }

    return true;
}
```

---

## Game Lifecycle

The platform handles these states automatically:

```
┌─────────────┐
│   LOADING   │  ─── Game initializing
└──────┬──────┘
       ▼
┌─────────────┐
│   READY     │  ─── "Press Start" screen shown
└──────┬──────┘
       ▼ (Player presses Start)
┌─────────────┐
│   PLAYING   │  ─── update() and render() running
└──────┬──────┘
       │ (P or Escape)
       ▼
┌─────────────┐
│   PAUSED    │  ─── onPause() called, loop paused
└──────┬──────┘
       │ (Resume)
       ▼
┌─────────────┐
│   PLAYING   │  ─── onResume() called
└──────┬──────┘
       │ (update returns false)
       ▼
┌─────────────┐
│  GAME OVER  │  ─── Score submitted, "Play Again" shown
└─────────────┘
```

---

## Scoring System

The platform automatically:
1. Calls `getScore()` when game ends
2. Submits to backend via `POST /api/stats/{game-slug}/score`
3. Shows "🏆 New High Score!" if it's a record

**Your game just needs to:**
```typescript
getScore(): number {
    return this.score;
}
```

---

## Save States (Optional)

To support save/load:

```typescript
getState(): Record<string, unknown> {
    return {
        score: this.score,
        level: this.level,
        playerPos: { x: this.player.x, y: this.player.y },
        // Any serializable data
    };
}

setState(state: Record<string, unknown>): void {
    this.score = state.score as number;
    this.level = state.level as number;
    this.player.x = (state.playerPos as any).x;
    this.player.y = (state.playerPos as any).y;
}
```

---

## Best Practices

### 1. Use Delta Time for Movement
```typescript
// ❌ Bad - speed depends on frame rate
this.x += 5;

// ✅ Good - consistent speed regardless of frame rate
this.x += this.speed * deltaTime;
```

### 2. Handle Game Over Gracefully
```typescript
update(deltaTime: number, input: InputState): boolean {
    if (this.gameOver) {
        // Allow restart with Space
        if (input.action) {
            this.startNewGame();
        }
        return true; // Keep loop running for restart
    }
    // Normal game logic...
    return true;
}
```

### 3. Keep Render Efficient
```typescript
render(ctx: CanvasRenderingContext2D): void {
    // Clear once
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    // Batch similar operations
    ctx.fillStyle = this.colors.player;
    // Draw all player elements...

    ctx.fillStyle = this.colors.enemy;
    // Draw all enemies...
}
```

### 4. Cleanup Resources
```typescript
destroy(): void {
    // Stop any running timers
    clearInterval(this.spawnTimer);
    // Release any audio
    this.backgroundMusic?.pause();
    console.log('[MyGame] Destroyed');
}
```

---

## Example: Complete Minimal Game

```typescript
import type { GameInstance, GameConfig, InputState } from '../sdk';

export class CatchGame implements GameInstance {
    private width = 800;
    private height = 600;
    private playerX = 400;
    private targetY = 0;
    private targetX = Math.random() * 800;
    private score = 0;
    private speed = 300;

    async init(canvas: HTMLCanvasElement, config: GameConfig): Promise<void> {
        this.width = canvas.width;
        this.height = canvas.height;
        this.playerX = this.width / 2;
    }

    update(deltaTime: number, input: InputState): boolean {
        // Move player
        if (input.left) this.playerX -= this.speed * deltaTime;
        if (input.right) this.playerX += this.speed * deltaTime;
        this.playerX = Math.max(25, Math.min(this.width - 25, this.playerX));

        // Move target down
        this.targetY += 200 * deltaTime;

        // Check catch
        if (this.targetY > this.height - 50) {
            if (Math.abs(this.targetX - this.playerX) < 40) {
                this.score += 10;
                this.resetTarget();
            } else {
                return false; // Game over!
            }
        }

        return true;
    }

    render(ctx: CanvasRenderingContext2D): void {
        // Background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.width, this.height);

        // Player (paddle)
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(this.playerX - 25, this.height - 30, 50, 10);

        // Target (falling object)
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.arc(this.targetX, this.targetY, 15, 0, Math.PI * 2);
        ctx.fill();

        // Score
        ctx.fillStyle = '#fff';
        ctx.font = '24px monospace';
        ctx.fillText(`Score: ${this.score}`, 20, 40);
    }

    getScore(): number {
        return this.score;
    }

    private resetTarget(): void {
        this.targetY = 0;
        this.targetX = Math.random() * (this.width - 60) + 30;
    }
}
```

---

## File Structure

```
frontend/src/
├── sdk/
│   ├── GameSDK.ts      # Interfaces & registry
│   ├── GameEngine.ts   # Game loop & lifecycle
│   ├── InputManager.ts # Keyboard handling
│   └── index.ts        # Exports
│
├── games/
│   ├── Snake.ts        # Example game
│   ├── MyGame.ts       # Your game!
│   └── index.ts        # Register all games
│
└── components/
    └── GameCanvas.tsx  # React wrapper (Start/Pause/GameOver UI)
```
