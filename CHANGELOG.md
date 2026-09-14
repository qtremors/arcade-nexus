# Arcade Nexus Changelog

> **Project:** Arcade Nexus
> **Version:** 0.4.1
> **Last Updated:** 2026-10-20

---

## [0.4.1] - 2026-09-14

- Connected the console shell, lazy feature routes, startup, and root recovery while retaining the existing visual styles.

## [0.4.0] - 2026-09-11

- Bundled game artwork, textures, and the original Flight model for local play.

## [0.3.9] - 2026-09-11

- Added volume, motion, remapping, retry, backup, and local diagnostic controls.

## [0.3.8] - 2026-09-11

- Added browser-inclusive backup export, restore previews, and server-snapshot management.

## [0.3.7] - 2026-09-09

- Added local player setup, switching, profile editing, and player history.

## [0.3.6] - 2026-09-09

- Added progress, household comparisons, awards, and paginated filtered history.

## [0.3.5] - 2026-09-08

- Added the Home page with Continue, recently played games, and a daily challenge.

## [0.3.4] - 2026-09-08

- Added game browsing, search, favorites, and featured-game presentation.

## [0.3.3] - 2026-09-07

- Added session launch, pause, results, and save-slot presentation.

## [0.3.2] - 2026-09-07

- Added run ownership, checkpoints, completion delivery, records, slots, and named session commands.

## [0.3.1] - 2026-09-07

- Added shared notifications, confirmations, focus management, and controller text entry.

## [0.3.0] - 2026-09-05

- Added lazy game loading, validated restore preflight, recovery snapshots, and retryable results.

## [0.2.9] - 2026-09-05

- Connected Stellar Flight's existing simulation, scenes, cameras, audio, and launch guide.

## [0.2.7] - 2026-09-03

- Added restorable Flight exploration, race progress, contracts, surveys, and ship progression.

## [0.2.5] - 2026-09-02

- Added the Prism Rush three-lane highway, authored rhythms, shields, and saves.

## [0.2.4] - 2026-09-01

- Added Asteroids with inertial flight, wrapping rocks, hulls, and escalating waves.

## [0.2.3] - 2026-09-01

- Added Tetris with hold, ghost landing, deterministic bags, and 40-line Sprint.

## [0.2.2] - 2026-09-01

- Added 2048 modes, deterministic undo, daily puzzles, and a semantic board reader.

## [0.2.1] - 2026-08-31

- Added Neon Breakout campaigns, arcade pickups, medals, and save compatibility.

## [0.2.0] - 2026-08-31

- Added Raptor Run obstacle phrases, biomes, deterministic saves, and rendering.

## [0.1.9] - 2026-08-29

- Added Neon Snake with classic, maze, sprint, and bonus modes and restorable state.

## [0.1.7] - 2026-08-20

- Added visibility-aware connection checks, local performance measurements, and runtime wiring.

## [0.1.6] - 2026-08-20

- Added shared local player, favorite, and preference state with validated controls.

## [0.1.5] - 2026-08-20

- Added fixed-step gameplay, pause lifecycle, and shared audio runtime capabilities.

## [0.1.4] - 2026-08-19

- Added keyboard, controller, and accessible menu navigation adapters.

## [0.1.2] - 2026-08-17

- Connected browser-facing profile, game, save, result, and backup clients to typed responses.

## [0.1.1] - 2026-08-17

- Added application startup, catalog synchronization, request protections, and the local source launcher.

## [0.1.0] - 2026-08-16

- Added completion, household records, history, achievements, and backup endpoints.

## [0.0.9] - 2026-08-16

- Added local player, game catalog, favorite, and manual-save endpoints.

## [0.0.8] - 2026-08-16

- Added portable backup transfer, player-copy restoration, and rotating server snapshots.

## [0.0.7] - 2026-08-10

- Added replayable completion receipts, compatible legacy sessions, and filtered history.

## [0.0.1] - 2026-07-27

- Established the source project, locked dependencies, and synchronized version metadata.

---

## Legacy History

The original entries below are preserved from before the repository's version reset.

<details>
<summary>Original changelog</summary>

# Arcade Nexus Changelog

> **Project:** Arcade Nexus  
> **Version:** 1.4.1  
> **Last Updated:** 2026-10-15

---

## Unreleased

- Fixed renderer retention found during the endurance pass: release Three r186 shared lighting-texture listeners and Flight sprite geometry. Real-browser repeated-entry regressions verify disposed games, engines and canvases collect; no context loss or shader/quality changes are used.

- Implemented the review follow-up: shared numeric contracts, explicit 2048 maximum-tile completion under rules version 4, pure save preflight, offline generated API types, backend transfer/session services, named session commands and phase panels, SDK ports, all six 2D simulation/renderer boundaries and a separate board reader, Flight steering/collision/race/objective policies, guarded session runtime/completion owners, API/history separation, feature style ownership and isolated browser/Node diagnostic fixtures. See docs/REVIEW_FOLLOWUP.md.

- Added a measured architecture/modularity review covering session ownership, router/service direction, API contract drift, save codecs, game aggregates, global styles and test/benchmark boundaries, with prioritized refactoring stages. This assessment changes documentation/metrics only.
- Completed a maintained-file review with a file ledger. Fixed server-save UUID mapping and unfinished reservations in backups, malformed snapshot handling, clock rollback retention, legacy session totals and development-server shutdown. Added resilient preference storage, controller handover/focus fixes, idle/error-safe system audio, stale-record protection, atomic terminal recovery cleanup, historical Raptor configuration migration and reduced-motion loop completion. The reproduced synthetic-save numeric boundary and its subsequent resolution are documented in docs/DEEP_REVIEW.md and docs/REVIEW_FOLLOWUP.md.
- Coalesced recovery snapshots behind slow requests while preserving deletion order and newer sessions. Fixed stale profile-list/activation responses and kept newly created players available after failed refreshes. Removed unused profile history reads, added compact achievement summaries and reduced achievement list queries. Progress now distinguishes loading from empty results and cancels abandoned record views.
- Stopped periodic recovery writes while paused while preserving immediate pause/exit snapshots. Added Full HD drawing-buffer and paused-write regressions during production browser review, and documented a headless software-canvas screenshot limitation without slowing production rendering.
- Added lazy route/backup loading, shared visibility-aware background checks, cross-tab retry locking, idle controller sleep, full-history sorting and filters, restore previews, seven-copy automatic server backups, root crash recovery and conflict-checked controls. Added desktop/zoom accessibility checks and a Full HD laptop diagnostic for native GPU, late-run scenes and repeated-entry memory.
- Made backup export use a fixed nine database queries, include results/recovery held in browser memory, and validate/remap browser entries on restore. Reconciled result retries across tabs, ignored corrupt performance history, and improved keyboard focus in nested menus and dialogs.
- Further reduced Flight overhead by reusing streamed sectors, skipping unchanged asteroid uploads, suspending silent engine audio, deduplicating audio automation and batching HUD layout reads before writes.
- Reduced game rendering work with a 60 FPS cap, suspended paused frame loops, Full HD Snake/Breakout artwork caches, precomputed Tetris rotations and per-asteroid camera culling. Both 3D games request low-power GPUs while retaining resolution, antialiasing and scene detail; benchmarks now include 1920 × 1080 runs and rendering resource counts.
- Added a single local launcher, production frontend serving, and a manual validation command. No CI/CD.
- Simplified navigation to Home, Games, Favorites and Progress; added real Continue, five-second recovery snapshots, backup export/import as copies, and visible result retries.
- Made completion atomic with replayed receipts, versioned mode/difficulty records, qualified awards, household comparisons and paginated history.
- Centralized game definitions and tuning; saved seeded gameplay randomness, fixed catch-up input consumption, and separated session effects from presentation.
- Added Snake maze/sprint, Raptor patterns/milestones, Breakout armored/explosive sectors and medals, relaxed/challenge 2048 with terminal undo, and finite scored Flight courses alongside free flight.
- Added daily challenges, controller text entry, remapping/dead-zone settings, Flight analog controls/world cycling and disconnect pause.
- Updated local regression coverage, setup/architecture documentation and the physical-device/playtest checklist.

## [1.4.1] - 2026-02-11

### Fixed
- **Security**: `DEBUG` now defaults to `False` in `config.py` (was `True`).
- **Security**: Removed unsafe `= ...` dependency defaults in `stats.py` session history endpoint.
- **React Hooks**: Fixed Rules of Hooks violation in `SessionHistoryModal.tsx` — early return was before hook calls.
- **Prod Error Leak**: `ErrorBoundary.tsx` now hides raw error messages in production builds.
- **Gamepad Crash**: Added guard for empty `games` array in `GameCarousel.tsx` gamepad handler.
- **Log Name**: Fixed `[AetherFlight]` → `[StellarFlight]` in `StellarFlight.ts`.

### Removed
- Unused `import re` from `games.py`.
- Duplicate `formatPlaytime()` from `GameCarousel.tsx` (canonical version in `utils/formatting.ts`).
- Dead `AtmosphereOverlay.tsx` component (returned `null`, zero imports).
- Legacy `add_column.py` migration script.

### Changed
- **DRY**: Extracted duplicate `utc_now()` from 6 model files into `app/datetime_utils.py`.
- **Dependencies**: Moved `@types/three` from `dependencies` to `devDependencies` in frontend `package.json`.

---

## [1.4.0] - 2026-01-16

### Changed
- **Premium Console Theme**: Complete redesign from transparency/glassmorphism to a solid "Premium Console" aesthetic (Charcoal/Zinc/Cyan).
- **Game Cards**: Replaced full-image gradient cards with a structured Split-View layout (Image Top / Solid Info Panel Bottom) for better readability.
- **System Menu**: Updated to a solid slate sidebar with crisp borders and high-contrast styling.
- **Global Palette**: Abandoned `#020205` (void black) for richer `#121214` (deep charcoal) to reduce visual fatigue and increase premium feel.
- **Removed**: All blur filters and glassmorphism effects have been removed to prioritize performance and visual clarity.

---

## [1.3.1] - 2026-01-12

### Changed
- **UI Simplification Overhaul**: Transitioned from "Neo-Retro" to a clean, color-forward console aesthetic.
- **Terminology Update**: Replaced technical jargon with user-friendly English across the entire UI and documentation (e.g., `THE_VAULT` -> **Library**, `IDENTITY_CORE` -> **Profile**).
- **Reduced Visual Noise**: Removed `AtmosphereOverlay` (film grain/vignette) and simplified `Background` to a static radial gradient.
- **Consistent Design**: Standardized rounded corners and improved layout spacing.

### Fixed
- **Profile Stat Cards**: Resolved duplicate display logic and fixed repetitive data visualization.
- **Linting**: Fixed duplicate imports and CSS syntax errors in global styles.

---

## [1.3.0] - 2026-01-12

### Added
- **Home Page Carousel**: Now dynamically displays Top 5 Recently Played games.
- **Session History Sorting**: Users can now sort history by Date, Score, or Duration.
- **Improved Modal**: "Recent Activity" and "High Scores" cards open tailored history views.

### Changed
- **Store**: "Stellar Flight" is now marked as "COMING SOON" with a construction icon.
- **Store**: Installation/Play disabled for incomplete games.

### Fixed
- **Score Logging**: Scores are now correctly recorded in database (previously 0).
- **Difficulty Tracking**: Difficulty setting (Easy/Normal/Hard) is now correctly logged for sessions.
- **Dashboard**: Fixed UI overlay clutter and improved navigation logic.

---

## [1.2.0] - 2026-01-12

### Added
- Toast notification system for user feedback
- Snake game border for visible play area
- Control hints for Stellar Flight game
- All 5 save slots now visible in UI (previously 3)

### Fixed
- FlightController keyboard controls (was using wrong key format)
- `FlightController` now uses proper `InputState` type instead of `any`
- External texture URL replaced with local asset for offline support
- CONTROL_HINTS dead key replaced with 'aether-flight'
- Frontend Game type now includes 'simulation' category
- InputManager console.logs wrapped in DEV check
- Achievements API documentation corrected

### Changed
- Project is now fully offline-capable
- Removed online-only features from roadmap

---

## [1.1.0] - 2026-01-03

### Added
- Complete testing infrastructure (`pytest` for backend, `vitest` for frontend)
- Loading animation for Dashboard game carousel
- Basic touch handling for canvas games
- 60-second stats caching to reduce network requests

### Changed
- Replaced external thumbnail URLs with local SVG assets for offline reliability
- Extracted utility functions and improved `GameSDK` type definitions
- Replaced Python-side filtering with direct SQL `COUNT` and `UPDATE` queries

### Fixed
- Session persistence - `SECRET_KEY` now persists across server restarts
- API client URL configuration for better environment compatibility

---

## [1.0.0] - 2025-12-14

### Added

#### Core Platform
- **Arcus Interface** - Console-style UI with glassmorphism and dynamic theming
- **Profile System** - Local profiles with Netflix-style selector
- **Game Library** - Personal collection with favorites and play tracking
- **Statistics Dashboard** - Track playtime, high scores, and sessions per game
- **Boot Sequence** - Immersive startup animation on first launch

#### Game SDK
- **2D Game Support** - Canvas-based games with full input handling
- **3D Game Support** - Three.js integration for WebGL games
- **Input Manager** - Keyboard and gamepad support with unified API
- **Game Engine** - Lifecycle management, pause/resume, game over handling
- **State Persistence** - Save and restore game state

#### Games Included
- **Neon Snake** - Classic arcade snake with cyberpunk aesthetics
- **Raptor Run** - Endless runner with day/night cycle
- **Stellar Flight** - 3D flight simulator with multiple atmospheres

#### Backend
- **FastAPI** - Async Python backend with SQLAlchemy
- **Auto-seeding** - Database populates on first run
- **RESTful API** - Games, profiles, stats, saves, library, achievements

#### UI/UX
- **Fullscreen Gaming** - Zero-distraction gameplay experience
- **Backend Status** - Live indicator shows server connection
- **Difficulty Settings** - Easy, Normal, Hard modes per game
- **Responsive Design** - Adapts to all desktop screen sizes

</details>
