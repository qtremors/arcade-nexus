# Development

## Runtime and architecture

Use Python 3.12 (`backend/.python-version`), Node 24 (`frontend/.nvmrc`), uv and npm. Dependencies are locked in `backend/uv.lock` and `frontend/package-lock.json`. Run `python arcade.py --setup` once, then `python arcade.py --dev`. No CI/CD services or workflows are configured.

React owns the console and menus. `GameCanvas` renders session presentation; `useGameSession` manages asynchronous lifecycle effects, clocks, and persistence; `services/lifecycle.ts` validates phase transitions. The SDK engine owns a fixed 60 Hz simulation, bounded catch-up, frame sampling, rendering, and input consumption. Game state stays outside React.

`catalog.json` owns bundled modes, rules versions, score units, difficulty support, and tuning defaults. The Python seed consumes it; frontend descriptors validate it and attach lazy loaders and controls metadata. Game state/configuration validation remains game-specific. There is no legacy synchronous registry. Catalog marketing copy and achievement definitions live in the backend seed; controls and tips live in `games/experience.ts`.

FastAPI serves the API and optionally the built frontend at one loopback origin. SQLite uses foreign keys, WAL and migrations. `0004_progress` adds mode records, recovery, and stored completion receipts. Startup creates a backup before upgrading an existing database. Do not edit previously applied migrations.

## Contracts

- All player requests carry `X-Profile-ID`; activation is per browser tab. Profiles are local selectors, not authentication.
- `POST /api/stats/{slug}/start` reserves a session UUID. A temporary server outage permits local play; completion can create a missing session.
- `POST /api/progress/{slug}/complete` commits immutable result, playtime, mode record and qualified awards in one transaction. The stored receipt is replayed exactly for an identical UUID/payload. Conflicting payloads return 409. Existing legacy completed sessions can be upgraded without double-counting duration.
- The browser completion queue persists before sending, retries temporary failures with bounded backoff, and retains permanent 4xx failures for explicit retry/export in Settings. Existing v1 queue entries remain readable.
- `GET /api/progress/records?household=true` includes other active local players. Compare like modes/difficulties/rules; an aggregate legacy high score remains available through stats for compatibility.
- `GET /api/progress/history?skip=0&limit=25&game_id=...` returns a real total and a page of completed sessions. Table sorting is explicitly within the loaded page.
- `GET /api/progress/recovery`, `PUT/DELETE /api/progress/recovery/{slug}` manage one recovery save per player/game, independently of manual slots.
- Save envelope format 2 carries game, mode, rules version, difficulty, config, RNG-containing game state, score, timestamp and originating session UUID. Format 1 defaults to classic/rules 1. Each game validates its state and defaults newly introduced fields for old full saves; incomplete/future saves fail visibly.
- Continue/load restores a board as a **new session**. It does not reopen an immutable completed UUID. Recovery captures state, not a promise to recover every millisecond of pre-crash playtime.
- `GET /api/data/export`, `POST /api/data/import` provide validated database JSON. The browser wrapper adds origin-specific preferences, recovery, and queued results. Import is transactional for database data; profile/session IDs are remapped, names are disambiguated, and originals stay intact. Browser storage failures after import are reported separately.

Use `/docs` or `/openapi.json` on the running server for the authoritative endpoint/schema reference. Compatibility stats/award endpoints remain available; new gameplay uses the single completion endpoint.

## Configuration

Backend settings are environment variables or `backend/.env` (see `app/config.py`). `DATA_DIR` selects persistent data; `DATABASE_URL` accepts SQLite only. `HOST` defaults to `127.0.0.1`, `PORT` to 8000. `FRONTEND_DIR` enables static production serving. `ALLOWED_HOSTS` and `CORS_ORIGINS` accept explicit JSON lists. `ALLOW_GAME_CREATION` defaults false. Normal request bodies are limited to 1 MB; data import accepts up to 20 MB. There is no `SECRET_KEY` requirement.

Vite proxies `/api` and `/health` to the local backend; `ARCADE_BACKEND_URL` overrides that development target. The normal launcher uses a fixed origin and serves production assets without Vite.

## Local checks

`python scripts/check.py` runs Ruff, pytest, ESLint, Vitest, TypeScript and Vite production build. Add `--browser` for Playwright. Browser tests launch isolated servers and a temporary database; never point them at a real household database. Install Chromium with `npx playwright install chromium` from frontend. `CHROMIUM_PATH` optionally chooses a local binary; `/usr/bin/chromium` is supported when present.

High-value regression checks cover idempotent receipts, legacy completion upgrade, profile isolation, transactional backup restore, pagination, saved RNG trajectories, terminal undo, actual board moves, catch-up input consumption, and browser save/retry/controller journeys. Run relevant checks during editing and the full local script before sharing a change.

Settings exposes bounded browser-stored samples of recent game initialization and frame-interval p50/p95; export JSON when comparing devices. Headless software-rendered browser results are functional evidence, not native GPU, input-latency, memory-leak, or game-balance certification. Use [PLAYTEST.md](docs/PLAYTEST.md) for those checks.

## Scope

Keep five games coherent before adding another. Native installers, network multiplayer, account authentication and third-party game plugins are outside this iteration. Full nonvisual access to real-time canvas games needs dedicated design; preserve semantic menus, focus trapping, reduced motion, and keyboard navigation when changing the shell.

Stellar Flight rules 4 is an endless space journey. Its rendering-independent `SpaceJourney` stores the universe seed, route RNG, five-ring race, visited sectors, XP, ship, boost/shield state, smooth steering velocities, race times/medals, objective baselines, camera, surveys, and collision/close-pass progress. The renderer streams 27 neighboring sectors and keeps the ship at its origin for precision on long trips. `ships.ts` builds three original hulls alongside the bundled `Jet.glb`; V / controller X switches unlocked ships (Vanguard at level 3, Star Manta at level 5). Rendering is decoupled from fixed simulation steps, resizes with the viewport, and adapts its pixel budget to slow frames. The software WebGL path starts with a smaller buffer; hardware renderers keep a higher resolution. The engine bed honors mute/volume and stops on pause/teardown. Manual and recovery saves retain upgrades. Rules 1/2 classic/course envelopes and full v1 states migrate into endless journeys. Earlier endless saves default the new fields and advance to rules 4; historical records keep their original rules version.
