# Arcade Nexus

A local arcade console for short desktop sessions, built with React, FastAPI, and SQLite. Eight bundled games, keyboard and standard-controller controls, local players, recovery saves, and household records. Assets and fonts are included; normal play does not require Internet access after setup.

## Start the console

Install Python 3.12, [uv](https://docs.astral.sh/uv/), and Node.js 24 with npm. From the repository root:

```bash
python arcade.py --setup
```

This installs locked dependencies, builds the frontend, starts the local server, and opens **http://127.0.0.1:8000**. Subsequent launches:

```bash
python arcade.py
```

Keep the terminal open while playing; Ctrl+C shuts down the console. Use `--no-browser` to open the address yourself. An occupied port produces an error instead of moving your console to a different browser-storage origin. This is a source launcher, not an installed desktop executable.

For development, after setup:

```bash
python arcade.py --dev
```

This runs both reload servers and opens **http://127.0.0.1:5173**. Browser preferences and unsynced results belong to that origin; export a backup before changing origins or browsers.

## Play and return

- **Home:** Continue recovery saves, recently played games, and today's seeded challenge.
- **Games:** Play any bundled title immediately. Favorites are optional.
- **Progress:** Records separated by game, mode, difficulty, and rules version; household comparisons, awards, and paginated session history.
- **Settings:** Volume, reduced motion, remapping, controller dead zone, pending-result retries, backup export/import, Full HD graphics, and local FPS/performance measurements.

| Game | Modes and objective |
| --- | --- |
| Neon Snake | Classic, four authored mazes, 60-second sprint, or Bonus Sprint with timed gold packets. |
| Raptor Run | Classic or daily authored obstacle phrases, four biomes, and genuine close-pass feedback. Jump, duck, and chase distance milestones. |
| Neon Breakout | Classic/daily three-sector campaigns or six-sector Arcade with timed wide-paddle and multiball pickups. Visible final-brick assistance and completion medals. |
| Merge 2048 | Relaxed play with deterministic one-move undo, no-undo challenge, or move-limited daily puzzles. Optional text board, slide buttons, and merge explanations. |
| Stellar Flight | Explore an endless procedural universe, chase gold across four race patterns, choose contracts, and survey three landmark types to refuel. Level up your engines and handling, unlock four ships with different energy and handling tradeoffs, and choose chase, nose, or wide cameras. Collisions preserve progress. |
| Neon Tetris | Marathon or time-ranked 40-line sprint, seven-piece bags, next previews, ghost landing, hold, wall kicks, and lock delay. |
| Asteroids | Inertial movement, wrapping arena, splitting rocks, escalating waves, three hulls, and respawn protection. |
| Prism Rush | 3D three-lane highway, authored gate rhythms with a clear route, collectible crystals, braking, and three shields. |

Pause with Escape/P or controller Start. Games pause on focus loss or controller disconnect. In menus, use directional controls and A/B; shoulder buttons change main tabs. Controller A on text fields opens an on-screen keyboard. Flight uses analog steering/triggers; Y plots a new race, X switches ships, B toggles surveys, right stick click changes the camera, and H/left stick click selects a contract (resetting its progress). Each launch menu has a controls guide.

Recovery snapshots are taken every five seconds and on pause/exit, separately from five manual slots. Continue restores the saved state as a new play session, preserving earlier history without counting earlier playtime twice. Sudden termination can lose up to the interval since the last durable snapshot. Result submission is atomic and retryable; Settings keeps failures visible and exportable.

## Keep your data

Settings → Export backup includes active players, favorites, saves, recovery, records, completed sessions, awards, browser preferences, and queued results. Import adds **copies** of players and restores preferences; existing players are preserved. Use the same browser origin for export to include its unsynced data. The JSON backup limit is 20 MB; very large histories need a database-file backup while the console is stopped.

SQLite lives in the platform's ArcadeNexus user-data directory (an existing `backend/arcade_nexus.db` remains supported). `DATA_DIR` or `DATABASE_URL` can override it. Schema migrations run at startup with a pre-upgrade backup. Local profiles are for a trusted household, not Internet authentication; keep the server on loopback.

## Local validation

```bash
cd frontend
npx playwright install chromium   # one-time browser installation
cd ..
python scripts/check.py --browser
```

The check script runs local lint, tests, type checking, and production build. Omit `--browser` for the faster checks. **There is no CI/CD configuration.**

For shipped improvements and remaining playtest priorities, see [the game improvement plan](docs/GAME_IMPROVEMENTS.md).

See [DEVELOPMENT.md](DEVELOPMENT.md), the [SDK guide](frontend/src/sdk/README.md), and [manual playtest checklist](docs/PLAYTEST.md). The [Tremors Source License](LICENSE.md) requires attribution; commercial use requires permission.
