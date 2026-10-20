<p align="center">
  <img src="docs/assets/arcade-nexus.png" alt="Arcade Nexus logo" width="120" />
</p>

<h1 align="center">Arcade Nexus</h1>

<p align="center">Your games. Your progress. Your local arcade.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white" alt="Python 3.12" />
  <img src="https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white" alt="Node.js 24" />
  <img src="https://img.shields.io/badge/License-TSL-red" alt="Tremors Source License" />
</p>

> [!NOTE]
> **Local by default:** Games, profiles, and progress stay on your computer. Normal play works offline after setup; the browser connects to the local server.

## Why Arcade Nexus

Arcade Nexus is a local browser-based console for short desktop play sessions. Eight bundled games share keyboard and controller controls, local player profiles, recovery saves, and household records. Assets and fonts are bundled; normal play works without Internet access after setup.

## Start the console

Install Python 3.12, [uv](https://docs.astral.sh/uv/), and Node.js 24 with npm. From the repository root:

```bash
python arcade.py --setup
```

Setup installs locked dependencies, builds the frontend, starts the local server, and opens **http://127.0.0.1:8000**. Internet access is needed for the initial dependency installation. For subsequent launches:

```bash
python arcade.py
```

Keep the terminal open while playing. Ctrl+C stops the console; `--no-browser` lets you open the address yourself. This project runs from source and does not distribute a desktop executable.

## Features

- **Eight games:** Arcade classics, authored daily challenges, and two 3D experiences.
- **Local players:** Separate profiles, favorites, achievements, and household comparisons.
- **Return to your run:** Recovery snapshots every five seconds and on pause/exit, plus five manual save slots.
- **Reliable results:** Retryable result delivery and records separated by game, mode, difficulty, and rules version.
- **Keyboard and controller:** Remapping, controller dead-zone settings, on-screen text entry, and automatic pause on focus loss or controller disconnect.
- **Keep your data:** JSON backup export/import, restore previews, and rotating server backups.
- **Comfort settings:** Volume, reduced motion, and a text-board option for 2048.

## Games

| Game | What to play |
| --- | --- |
| Neon Snake | Classic, authored mazes, timed Sprint, and Bonus Sprint. |
| Raptor Run | Jump and duck through obstacle phrases across four biomes. |
| Neon Breakout | Three-sector campaigns or six-sector Arcade with pickups and medals. |
| Merge 2048 | Relaxed play with undo, no-undo Challenge, or daily puzzles. |
| Stellar Flight | Explore a procedural universe, race, survey landmarks, and unlock ships. |
| Neon Tetris | Marathon or a time-ranked 40-line Sprint. |
| Asteroids | Wraparound flight, splitting rocks, escalating waves, and three hulls. |
| Prism Rush | A 3D three-lane highway with authored rhythms and collectible crystals. |

## Controls and recovery

Pause with Escape/P or controller Start. Use directional controls and A/B in menus; shoulder buttons change main tabs. Each game's launch menu explains its controls.

Continue restores a saved board as a new session, keeping earlier history separate. A sudden termination can lose progress since the last durable snapshot. Settings shows results that still need to sync.

## Your data

Settings provides backup export, previews, import, and automatic server snapshots. Import creates player copies and keeps existing players. Export from the same browser origin to include its preferences, recovery, and pending results. Keep a tab open if it reports browser storage failures until its data is saved or exported.

The database lives in the platform's ArcadeNexus user-data directory. An existing `backend/arcade_nexus.db` remains supported. Local profiles are for a trusted household; keep the server on loopback. Read [PRIVACY.md](PRIVACY.md) for storage and network details.

## Community and support

- Report bugs or request features through [GitHub Issues](https://github.com/qtremors/arcade-nexus/issues).
- Review completed changes in [CHANGELOG.md](CHANGELOG.md) and unfinished work in [TASKS.md](TASKS.md).

## Credits

Arcade Nexus is built by [Tremors](https://github.com/qtremors). Thanks to the maintainers of:

- [React](https://react.dev/), [React Router](https://reactrouter.com/), [Zustand](https://zustand.docs.pmnd.rs/), [Zod](https://zod.dev/), and [Axios](https://axios-http.com/) for the console and browser data flow.
- [Three.js](https://threejs.org/), [Motion](https://motion.dev/), and [Lucide](https://lucide.dev/) for rendering, animation, and icons.
- [FastAPI](https://fastapi.tiangolo.com/), [Pydantic](https://docs.pydantic.dev/), [SQLAlchemy](https://www.sqlalchemy.org/), [Alembic](https://alembic.sqlalchemy.org/), and [SQLite](https://sqlite.org/) for the local server and persistence.
- [Vite](https://vite.dev/), [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/), and [uv](https://docs.astral.sh/uv/) for development and verification.
- [Rajdhani](https://fonts.google.com/specimen/Rajdhani), [JetBrains Mono](https://www.jetbrains.com/lp/mono/), [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P), and [Fontsource](https://fontsource.org/) for bundled typography. The website's Rajdhani license is included with its [font assets](docs/assets/rajdhani-license.txt).

The project manifests and lockfiles list the complete dependencies. Each project remains the property of its respective authors and is used under its own license.

## For developers

Architecture, setup, configuration, game integration, save compatibility, testing, performance checks, and maintenance conventions live in [DEVELOPMENT.md](DEVELOPMENT.md).

## License

Arcade Nexus is source-available under the **Tremors Source License (TSL) Version 2.0**. Attribution is required; commercial use requires written permission. Read [LICENSE.md](LICENSE.md).

---

<p align="center">Made by <a href="https://github.com/qtremors">Tremors</a></p>
