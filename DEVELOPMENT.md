# Arcade Nexus - Developer Documentation

> Comprehensive documentation for developers working on Arcade Nexus.

**Version:** 1.3.1 | **Last Updated:** 2026-01-12

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)
- [Environment Variables](#environment-variables)
- [Game SDK](#game-sdk)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

Arcade Nexus follows a **client-server** architecture with a React frontend and FastAPI backend:

```
┌──────────────────────────────────────────────────────────────┐
│                         FRONTEND                              │
│   React 19 + TypeScript + Vite + Tailwind + Zustand          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Your Game  │───▶│  Game Engine │───▶│   Canvas 2D  │   │
│  │  (GameSDK)   │    │   (Loop)     │    │  or Three.js │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└──────────────────────────────────────────────────────────────┘
                              │ HTTP API
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                         BACKEND                               │
│              FastAPI + SQLAlchemy + Pydantic                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Routers    │───▶│   Schemas    │───▶│   Models     │   │
│  │  (API)       │    │  (Validate)  │    │  (ORM)       │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│                              │                                │
│                              ▼                                │
│                     ┌──────────────┐                         │
│                     │    SQLite    │                         │
│                     └──────────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite (async) | Simple, file-based, no server needed for local gaming |
| Zustand | Minimal state management, works great with React 19 |
| Game SDK pattern | Decouples games from platform, easy to add new games |
| Local profiles | No authentication needed, Netflix-style UX |

---

## Project Structure

```
arcade-nexus/
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   │   ├── api/              # Axios API client
│   │   ├── components/       # UI components
│   │   │   ├── GameCanvas.tsx    # Core game rendering
│   │   │   ├── Layout.tsx        # App shell
│   │   │   └── arcus/           # Common UI components
│   │   ├── contexts/         # React contexts
│   │   ├── games/            # Game implementations
│   │   │   ├── snake/            # 2D Canvas game
│   │   │   ├── raptor-run/       # 2D Canvas game
│   │   │   └── stellar-flight/    # 3D Three.js game
│   │   ├── pages/            # Route pages
│   │   ├── sdk/              # Game SDK
│   │   │   ├── GameSDK.ts        # Interfaces & registry
│   │   │   ├── GameEngine.ts     # Game loop
│   │   │   └── InputManager.ts   # Keyboard handling
│   │   ├── stores/           # Zustand stores
│   │   └── App.tsx           # Root component
│   ├── public/               # Static assets
│   │   ├── games/            # Game thumbnails (SVG)
│   │   └── models/           # 3D models (GLTF)
│   └── package.json
│
├── backend/                  # FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── models/           # SQLAlchemy ORM models
│   │   │   ├── user.py           # Profile model
│   │   │   ├── game.py           # Game metadata
│   │   │   ├── library.py        # User's game collection
│   │   │   ├── stats.py          # Play statistics
│   │   │   ├── save.py           # Save states
│   │   │   └── achievement.py    # Achievements
│   │   ├── routers/          # API endpoints
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── utils/            # Helpers
│   │   ├── main.py           # FastAPI app entry
│   │   ├── config.py         # Settings
│   │   ├── database.py       # DB connection
│   │   └── seed.py           # Initial data
│   ├── tests/                # pytest tests
│   └── pyproject.toml
│
├── README.md
├── DEVELOPMENT.md            # This file
├── CHANGELOG.md
├── LICENSE.md
└── TASKS.md
```

---

## Database Schema

### Models Overview (6 total)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **User** | Local profiles | `username`, `avatar`, `is_default` |
| **Game** | Game metadata | `slug`, `title`, `category`, `config` |
| **UserLibrary** | User's game collection | `user_id`, `game_id`, `last_played` |
| **PlayStats** | Per-user per-game stats | `total_playtime_seconds`, `high_score`, `sessions_count` |
| **GameSave** | Save slots (1-5) | `slot`, `data` (JSON), `thumbnail` |
| **Achievement** | Achievement definitions | `slug`, `title`, `unlock_condition` |
| **AchievementUnlocked** | User's unlocked achievements | `user_id`, `achievement_id`, `unlocked_at` |

### Relationships

```
User ─────1:N───── UserLibrary ─────N:1───── Game
  │                                           │
  ├───1:N───── PlayStats ─────N:1─────────────┤
  │                                           │
  ├───1:N───── GameSave ─────N:1──────────────┤
  │                                           │
  └───1:N───── AchievementUnlocked            │
                      │                       │
                    N:1                       │
                      │                       │
               Achievement ─────N:1───────────┘
```

---

## API Routes

### Profiles (`/api/profiles`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all profiles |
| GET | `/active` | Get active profile |
| POST | `/` | Create profile |
| GET | `/{id}` | Get profile by ID |
| PUT | `/{id}` | Update profile |
| POST | `/{id}/activate` | Switch to profile |
| DELETE | `/{id}` | Delete profile (soft) |

### Games (`/api/games`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List games (supports `?category=`, `?search=`) |
| GET | `/categories` | List all categories |
| GET | `/{slug}` | Get game by slug |
| POST | `/` | Create game (admin) |

### Library (`/api/library`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Get user's library |
| POST | `/{game_id}` | Add game to library |
| DELETE | `/{game_id}` | Remove from library |

### Stats (`/api/stats`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Get overall stats |
| GET | `/{game_slug}` | Get game-specific stats |
| POST | `/{game_slug}/start` | Start play session |
| POST | `/{game_slug}/session` | Record playtime |
| POST | `/{game_slug}/score` | Submit high score |

### Saves (`/api/saves`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/{game_slug}` | List saves for game |
| POST | `/{game_slug}` | Create/update save |
| DELETE | `/{game_slug}/{slot}` | Delete save slot |

### Achievements (`/api/achievements`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all achievements with unlock status |
| GET | `/{game_slug}` | List achievements for game |
| POST | `/unlock` | Unlock achievement (body: `{game_slug, achievement_slug}`) |

---

## Environment Variables

### Backend (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Session signing key | Auto-generated (dev only) |
| `DATABASE_URL` | SQLite connection | `sqlite+aiosqlite:///./arcade_nexus.db` |
| `DEBUG` | Enable debug mode | `True` |
| `CORS_ORIGINS` | Allowed origins | `["http://localhost:5173"]` |

### Frontend (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend URL | `http://localhost:8000` |

---

## Game SDK

See [frontend/src/sdk/README.md](frontend/src/sdk/README.md) for comprehensive SDK documentation.

### Quick Reference

```typescript
// Implement GameInstance interface
export class MyGame implements Game2DInstance {
    readonly type = '2d';
    
    init(canvas: HTMLCanvasElement, config: GameConfig): void { }
    update(deltaTime: number, input: InputState): boolean { return true; }
    render(ctx: CanvasRenderingContext2D): void { }
    getScore(): number { return this.score; }
}

// Register with SDK
registerGame('my-game', () => new MyGame());
```

---

## Testing

### Backend

```bash
cd backend
uv run pytest                    # All tests
uv run pytest tests/test_api.py  # Specific file
uv run pytest -v                 # Verbose
```

### Frontend

```bash
cd frontend
npm test              # All tests (vitest)
npm test -- --watch   # Watch mode
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **Backend session errors** | Set `SECRET_KEY` in `.env` for persistence |
| **3D games not loading** | Enable WebGL in browser settings |
| **CORS errors** | Add your origin to `CORS_ORIGINS` in config |
| **Database locked** | Close other connections, restart backend |

### Debug Mode

```bash
# Backend with auto-reload
cd backend
uv run uvicorn app.main:app --reload --log-level debug

# Frontend with dev tools
cd frontend
npm run dev
```

---

<p align="center">
  <a href="README.md">← Back to README</a>
</p>
