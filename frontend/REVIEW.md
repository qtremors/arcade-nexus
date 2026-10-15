# Frontend review and browser validation

For the subsequent implemented review work, see [REVIEW_FOLLOWUP.md](../docs/REVIEW_FOLLOWUP.md).

Historical review record. For current contracts and validation, see [DEVELOPMENT.md](../DEVELOPMENT.md) and [the deep review](../docs/DEEP_REVIEW.md).

Reviewed on `ag-dev` for a local application that opens in a normal browser. FastAPI/SQLite remains the backend; no WebView or Rust migration was introduced. This records the changes and tested behavior, not a claim that every possible issue has been eliminated.

## Review passes

1. Read the source, configuration, API calls, stores, SDK and all existing games. Traced initialization, profile changes, save/load, session completion and asynchronous callbacks. Found non-retryable startup, a profile refetch loop, stale player caches, incomplete saves, session attribution gaps, controller/input issues, misleading metrics/settings, external assets and vulnerable dependencies.
2. Reworked integration and lifecycle, then checked types, lint, unit tests and the production build. Verified fixed-step simulation, complete validated saves, cancellation during async initialization, request ordering, profile isolation and replay-safe session submission. Added Breakout and Merge 2048.
3. Ran real-browser HTTP journeys and inspected screenshots. Fixed the migrated CSS cascade, quick pause taps, proxy host/origin behavior, a remove button covered by its card, misleading disabled flight listing, and the aircraft's scale/lighting/camera. Repeated the journeys after changes; added cross-tab attribution and document-cache restoration checks. Longer gameplay revealed that 2048 ignored rapid direction changes; replaced its shared input latch with a direction-specific latch and added a regression test.

## File review matrix

| Files | Findings and resulting behavior |
| --- | --- |
| `package.json`, `package-lock.json` | Updated vulnerable runtime/tooling packages, moved to Vite 8/Tailwind 4/Vitest 5, added Playwright/Zod/local fonts/formatting. Audit reports no known vulnerabilities at validation time. |
| `vite.config.ts`, `tailwind.config.js`, former `postcss.config.js` | One API proxy convention; preserve browser host, loopback dev/preview servers, test setup configured, Tailwind Vite integration replaces obsolete PostCSS setup. |
| `tsconfig*.json`, `eslint.config.js`, `playwright.config.ts`, `.gitignore` | Strict application/config/test type checking; lint unchanged in intent; reproducible browser tests and ignored artifacts. |
| `index.html`, `main.tsx`, `App.tsx`, `App.css`, `index.css` | Correct title/favicon, StrictMode retained, retryable startup, per-player route remounts, global error/toast handling, pending-result retries, local fonts. Removed unused legacy CSS that overrode utility spacing. Visible scrollbars, focus outlines, reduced-motion preferences and responsive page sizing. |
| `api/client.ts` | Unified API/health URL resolution, typed errors retaining HTTP status, validation-array messages, profile headers, session UUIDs/metrics and discovered achievement conditions. |
| `stores/profileStore.ts` | Initialization can retry and coalesces concurrent calls. Stats cache is invalidated across player changes; outdated responses cannot overwrite a different profile or a later selection generation. Tabs retain their own player. |
| `stores/libraryStore.ts`, `stores/gamesStore.ts` | Latest-request guards; no stale optimistic rollback overwriting unrelated changes. Mutations refresh authoritative library membership. |
| `stores/settingsStore.ts`, `pages/Settings.tsx` | Persistent, bounded audio/mute/animation preferences and measured connection status. Removed inert reset-data button and fictional graphics/latency claims. |
| `pages/Profile.tsx` | Removed dependency-driven refetch loop and fabricated hardware/storage/skill metrics. Real progress, editing, player creation/switch/removal and session history. |
| `pages/Store.tsx`, `pages/Library.tsx` | Real filtering/search, request ordering, visible error feedback, working add/remove/play, no hardcoded unavailable flight. Removal keeps saves and stats. |
| `pages/Dashboard.tsx`, `components/arcus/GameCarousel.tsx` | Shared stats cache, recent ordering without hiding the rest of the catalog, explicit previous/next buttons, modal-aware shortcuts and keyboard-accessible selection. |
| `pages/Achievements.tsx`, `pages/GamePlayer.tsx`, `pages/index.ts` | Real award counts/errors; stale game responses ignored; unknown game recovery; metadata config passed to SDK. Export barrel retained. |
| `components/Layout.tsx`, `arcus/SystemMenu.tsx` | Correct health endpoint/status labels; named navigation, modal focus/inert background, hidden menu removed from focus order, settings closes menu; removed inert logout and fixed fake latency. |
| `arcus/BootSequence.tsx`, `ProfileSetup.tsx`, `ProfileSelector.tsx`, `GameCard.tsx` | Skippable intro, truthful local-data copy, validated named input, selection errors handled, semantic card buttons, local fallback art and readable action labels. |
| `components/GameCanvas.tsx` | Async initialization cancellation, immutable per-profile session UUIDs, safe start/restart/quit, active-time clock, auto pause, buffered pause shortcuts, complete save envelopes, validate before replacement, load from ready screen, recover cached-document sessions with a new UUID. |
| `services/sessionQueue.ts` | Persist individual completions before submission, validate stored data, coalesce concurrent sends, pin player/metrics, retry after reload, retain failures. Separate keys avoid concurrent tabs overwriting one shared queue. Exit request is best effort. |
| `components/Toast.tsx`, `hooks/useToast.ts` | Stable unique IDs, cleaned timers/animation callbacks and accessible notifications. Separate context hook avoids mixed component exports. |
| `SessionHistoryModal.tsx`, `ErrorBoundary.tsx`, `LoadingSpinner.tsx`, `Background.tsx` | Modal focus/escape behavior, clearer recovery language, retained simple loading/background components. |
| `hooks/useModalFocus.ts`, `useGamepad.ts`, former `contexts/FocusContext.tsx` | Native keyboard focus and dialog traps replace unused visual-only focus registry. Controller callbacks use current state without dynamic dependency arrays. |
| `sdk/GameSDK.ts`, `GameEngine.ts`, `index.ts` | Typed measurement support, 60 Hz simulation, safe async teardown, frame-error delivery, idempotent destruction and explicit save capability. Legacy registry/exports retained; bundled games use async imports. |
| `sdk/InputManager.ts`, `GamepadManager.ts` | Quick taps buffered, typing ignored, keys cleared on blur/pause, already-connected/nonzero-index pads detected, stick reversal works, all standard buttons mapped, polling stops without subscribers. |
| `sdk/AudioManager.ts` | Real stored audio preferences, supported AudioContext checks, rejected resume handled, nodes disconnected after playback. |
| `games/index.ts`, game export barrels | Lazy loader for all five bundled games; export barrels retained. Console does not load Three.js until flight is opened. |
| `games/snake/Snake.ts` | Finite food placement on full boards, legal movement into vacated tail, bounded/validated complete simulation snapshots, stable logical grid. |
| `games/raptor-run/RaptorRun.ts` | Difficulty retained during updates/spawning, same-frame collision ending, actual jump measurements, complete snapshots, clearer airborne silhouette and score placement. |
| `games/stellar-flight/FlightController.ts`, `StellarFlight.ts` | Initial throttle, reachable speed milestone, correct pitch/Digit keys, edge-triggered maps, disposed terrain/assets, async teardown guards, stable canvas scaling, normalized/lit model, aircraft-relative chase camera, space stars, crash/end behavior and flight saves/measurements. |
| `games/breakout/Breakout.ts`, `games/merge-2048/Merge2048.ts` | New playable local games, defined scoring/end behavior, complete validated saves; 2048 merges each tile once and spawns only after a changed move. Breakout uses three lives and paddle-based difficulty. |
| `utils/formatting.ts` | Existing duration formatter reviewed and retained. |
| `components/Confirmation.tsx`, `hooks/useConfirmation.tsx`, `sdk/menuNavigation.ts` | Native modal focus/inert behavior, safe initial cancellation, Escape/controller cancellation, pending-question cleanup on route exit, and spatial focus for console pages. Controller routing prevents the system menu and game pause from handling the same input. |
| `games/feedback.ts`, `games/stellar-flight/course.ts` | Bounded cosmetic feedback uses real preferences; pure swept-gate detection and terrain triangle interpolation are covered by regression tests. |
| `public/games/*`, model/texture/logo, former Vite/React starter assets | Local assets exercised in browser. Added new-game art, replaced flight's duplicate raptor thumbnail, removed unused starter assets. Aircraft asset inspected for bounds/materials and normalized at runtime. |
| `src/__tests__/*`, `e2e/*`, SDK/frontend documentation | Placeholder test replaced with behavior tests; real-server browser journeys use temporary databases; updated controls, save contract and extension guide. |

## Browser journeys

The Playwright suite drives Chromium through normal controls with real FastAPI/SQLite requests. All five games were opened and controlled; their rendered output was visually inspected. Flight was accelerated beyond the Mach 1 threshold and switched between Earth, Mars and space. Save restoration compared complete 2048 state after returning to the console; the other games' snapshots were checked across a browser resize. Additional journeys cover library filtering/removal, profile creation/switching, preference persistence, focus-loss pause, outage/retry, replay after reload, concurrent tabs and a restored document's session identity.

The browser pass found real integration/visual issues beyond the unit tests. Flight's renderer was technically running but the aircraft appeared as a tiny dark dot; the final chase camera keeps it legible at high speed, and the space map has a visible star field. The library remove control's stacking order was corrected rather than forcing a click in the test.

Additional gameplay used ordinary keyboard controls and canvas observations, without injecting simulation state: Breakout scored 110 over 20 seconds, Raptor Run scored 155, Snake scored 40, and the final rapid-direction 2048 run scored 344. These runs produced no browser page errors. The 390-pixel-wide settings page was also inspected and measured with no horizontal overflow. Flight's Earth, Mars and space views, acceleration, camera, saves and speed achievement were exercised in the browser suite. These are smoke journeys, not exhaustive game balancing or long-term endurance tests.

## Validation and limits

Final checks on `ag-dev` on 2026-10-10:

- Backend: 86 tests pass with 96% application statement coverage; Ruff lint and formatting pass.
- Frontend: all 52 unit tests in six files pass; ESLint and Prettier pass.
- Real-server Chromium suite: all eleven browser journeys pass after the experience pass, including undo, flight course/save restoration, controller menu actions, confirmation cancellation and input isolation.
- Clean installation with `npm ci` succeeds. TypeScript checking and the Vite production build succeed. `npm audit` reports zero known vulnerabilities.
- `git diff --check` passes. Test databases were isolated from user data.

Production output separates small 2D game chunks from the optional Three.js flight chunk. The main JavaScript bundle is 491 kB minified (153 kB compressed), down from approximately 985 kB (276 kB compressed). The flight chunk remains about 624 kB minified (158 kB compressed) and produces the standard large-chunk warning; it is loaded only when flight is opened.

Validated on Linux Chromium with software WebGL and synthetic controller API tests. Physical controllers, native GPUs, Windows/macOS installers and Firefox/Safari are not certified by this review. The app still uses a local server workflow; browser auto-launch, a bundled executable/static server and scheduled backups are separate work. Sudden process/OS failure may lose the current unsaved run; page-exit delivery is best effort. Old score-only saves cannot be converted into missing simulation state. Local profiles and client-reported scores/measurements are not authenticated competitive accounts.

## Experience pass

The user clarified that visuals, interactions and the whole experience should meet a console standard. Revisited the games as experiences, rather than treating successful API journeys as proof of quality. Added distinct Breakout sectors and impact feedback; 2048 movement, hierarchy and undo; Snake turn buffering; deliberate Raptor jumps and clearer art/scenery; and a Flight gate course, banked turns, terrain and clearance warnings. Launch/pause/results now share a coherent panel design. Removal actions use native-modal console dialogs. Controller navigation covers main console pages and preferences, and Start no longer opens the system menu during play.

New mechanics have backwards-compatible full-save defaults and regression coverage. Terrain collision heights use the same triangle interpolation as the rendered mesh. A raycast check caught an incorrect diagonal in the new interpolation; the corrected implementation is covered against actual Three.js mesh intersections across both maps and recentered terrain. Gate detection tests a swept segment to avoid skipping a gate at high speed. A browser failure during rapid undo testing exposed a test timing assumption: pausing before a simulation frame can correctly discard the queued input. The journey now waits for simulation frames before comparing snapshots. The controller journey also exposed slow-frame pause input; Start now pauses directly from the controller event, like keyboard Escape, and confirm input waits for release before gameplay uses it.

See [EXPERIENCE.md](EXPERIENCE.md) for actual browser screenshots and the remaining release bar. Gameplay balance, authored animation/audio depth and performance on native hardware need further evaluation; this pass does not establish that the games are finished console releases.


## Stellar Flight follow-up — 2026-10-12

Flight now uses an endless procedural space world with optional timed ring races, precision bonuses, medals, personal pace records, rotating objectives, and survey beacons. Surveying refuels boost and shields; impacts preserve the journey. The original GLB sits alongside three original geometric hulls with different performance and handling. Camera choices, steering velocities, race records, objectives, and surveys persist in full saves. Earlier flight and endless saves migrate into rules 4 without replacing their historical records.

Repeated keyboard play cleared actual ring races and earned gold. A twenty-minute analog simulation covers continuing play, bounded resident sectors, and deterministic restoration during a turn. Browser checks exercise ship switching, real beacon collection, camera restoration, narrow viewport aspect ratio, and cancellation of a restart. New audio checks cover silence before play, mute/volume, pause, teardown, and a failed audio initialization. Browser testing exposed a fast resume/pause timing assumption; the helper now waits for the active play controls before sending pause. Fresh keyboard presses also override saved toggle latches, so a camera tap is retained immediately after loading.

The cockpit uses restrained instruments and leaves the racing line visible. Rendering work runs once per displayed frame, with adaptive resolution, lighter scenery, and a higher pixel budget on hardware renderers. In this environment's software WebGL keyboard sessions, median frame time improved from roughly 100 ms to 50 ms as the adaptive path lowered rendering resolution. This is a software-renderer measurement, not a hardware GPU certification. Screenshot artifacts are kept outside the repository in the execution workspace.
