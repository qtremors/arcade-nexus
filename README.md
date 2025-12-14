# Arcade Nexus

A premium local arcade gaming console built with React, FastAPI, and a custom Game SDK.

![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)

## Features

- **Aether OS Interface** - Console-style UI with glassmorphism effects
- **Custom Game SDK** - Build 2D and 3D games with unified API
- **Local Profiles** - Netflix-style profile selection
- **Statistics Tracking** - Playtime, high scores, sessions
- **Fullscreen Gaming** - Zero-distraction gameplay

## Games Included

| Game | Type | Description |
|------|------|-------------|
| 🐍 Neon Snake | 2D | Classic arcade snake with cyberpunk aesthetics |
| 🦖 Raptor Run | 2D | Endless runner with day/night cycle |
| 🚀 Stellar Drift | 3D | Space adventure with boost mechanics |

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- uv (Python package manager)

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

## Project Structure

```
arcade-nexus/
├── frontend/           # React + TypeScript + Vite
│   └── src/
│       ├── components/ # UI components
│       ├── games/      # Game implementations
│       ├── pages/      # Route pages
│       └── sdk/        # Game SDK
└── backend/            # FastAPI + SQLAlchemy
    └── app/
        ├── models/     # Database models
        ├── routers/    # API endpoints
        └── schemas/    # Pydantic schemas
```

## Creating Games

Games implement either `Game2DInstance` or `Game3DInstance`:

```typescript
import type { Game2DInstance, GameConfig, InputState } from '../sdk/GameSDK';

export class MyGame implements Game2DInstance {
    readonly type = '2d';
    
    init(canvas: HTMLCanvasElement, config?: GameConfig): void {
        // Setup
    }
    
    update(deltaTime: number, input: InputState): boolean {
        // Return false when game over
        return true;
    }
    
    render(ctx: CanvasRenderingContext2D): void {
        // Draw
    }
    
    getScore(): number {
        return this.score;
    }
    
    destroy(): void {
        // Cleanup
    }
}
```

Register in `frontend/src/games/index.ts`:

```typescript
registerGame('my-game', () => new MyGame());
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/games` | List all games |
| `GET /api/profiles` | List profiles |
| `POST /api/stats/{game}/session` | Record play session |
| `POST /api/stats/{game}/score` | Submit score |
| `GET /api/stats/overall` | Get all stats |

## License

MIT
