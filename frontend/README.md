# Arcade Nexus frontend

A local browser console built with React, TypeScript, Vite and Canvas/WebGL. The backend remains FastAPI/SQLite. Games, fonts, thumbnails and the aircraft model are bundled; normal gameplay makes no external network requests.

## Run

Start the API from the repository's backend directory:

```sh
uv sync --locked
uv run python run.py
```

In a second terminal, from frontend:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173 in a browser. Vite proxies `/api` and `/health` to the local API at port 8000, preserving the browser host. `ARCADE_BACKEND_URL` changes that development proxy target. `VITE_API_URL` may point directly to an API origin or an existing `/api` URL; configure backend origins when using a different browser origin.

For a local production-build preview, run `npm run build` then `npm run preview`. The preview also proxies API requests. This is not an installer or a bundled executable launcher.

## Games and controls

| Game | Controls | Goal |
| --- | --- | --- |
| Neon Snake | Arrows / WASD; two turns can be buffered | Eat packets, avoid walls and your body |
| Raptor Run | Up / Space to jump; Down to duck or fall faster | Survive obstacles; a jump pressed just before landing is buffered |
| Stellar Flight | Arrows / WASD for pitch and banking; Q/E for yaw; Shift/Ctrl for throttle; 1–3 for maps | Fly through cyan gates over rolling terrain; score remains peak speed |
| Neon Breakout | Left/Right / A/D; Space to launch | Clear three distinct sectors with three lives; paddle position aims rebounds |
| Merge 2048 | Arrows / WASD; Z or controller B to undo one move | Merge equal tiles; continue after reaching 2048 |

Escape or P pauses gameplay. Escape resumes the pause screen. Losing window focus or hiding the tab pauses automatically. Mouse and native keyboard focus work in menus. Standard gamepads provide direction, confirm, cancel and pause; flight also maps shoulder buttons to yaw and triggers to throttle.

Start/Resume receives focus in game menus. The toolbar offers browser fullscreen. Library, player and save removal use accessible console dialogs, with cancellation focused first. Outside games, controller shoulder buttons switch Home/Store/Library/Achievements; directional input moves focus on other pages, A activates controls, and B returns home. Controller Start pauses gameplay without opening the system menu. Text entry still needs a keyboard or the operating system's text-input interface; an on-screen console keyboard is not included.

Collection, collision and jump effects share the sound volume/mute preferences. Reduced animations disable optional bursts, trails and tile movement. Flight course progress, Breakout sectors, Snake's turn queue and 2048's undo state are saved. Full simulation saves from before these additions remain accepted with defaults for the new fields.

Difficulty changes gameplay in Snake, Raptor Run and Breakout. Each game supports five complete simulation saves. Old score-only saves are kept in the database but rejected with an explanation because they cannot reconstruct a game.

## Profiles and persistence

A tab remembers its player in sessionStorage and sends `X-Profile-ID` on player requests. Switching players remounts player-facing pages, clears cached statistics and ignores outdated responses. A game captures its profile at launch.

Session starts and completions use UUIDs. Active playtime excludes pauses. Completed results are queued under separate localStorage keys before submission; a failed request is retried after reload or periodically while the console is open. The queue carries the original player and completion payload, so retries cannot duplicate playtime or move progress to a different player. Page exit makes a best-effort completion request. A browser or OS crash can still lose progress since the last manual save or recorded completion. If browser storage is unavailable, retry persistence lasts only for the current page.

Volume, mute and reduced animations are real preferences saved in this browser. Profile statistics and achievement counts come from the backend. No CPU/GPU/temperature, storage usage or latency values are simulated. Planet flight instruments show clearance above the rendered terrain; altitude achievements retain the existing world-height datum.

## Checks

```sh
npm run lint
npm run test:unit
npm run build
npm audit
npm run test:e2e
```

Browser tests start isolated backend/frontend servers on ports 8011 and 5174 and use temporary databases. Install uv and Chromium; set `CHROMIUM_PATH` to your Chromium binary if it is not `/usr/bin/chromium`. Linux browser tests use software WebGL. Unit tests cover game rules, save restoration, engine lifecycle/input, request races, profile isolation, retry queues and startup recovery. Browser tests cover real HTTP journeys and all five games; screenshots and traces are written to ignored `test-results/`.

See [REVIEW.md](REVIEW.md) for the review matrix, observed issues and validation limits, and [the SDK guide](src/sdk/README.md) for adding a game.

See [EXPERIENCE.md](EXPERIENCE.md) for the console experience standard, this quality pass, and gameplay screenshots.
