# Arcade Nexus - Tasks

> **Project:** Arcade Nexus  
> **Version:** 1.4.1
> **Last Updated:** 2026-02-18

---

## 📋 To Do

### 🔴 Critical Priority

#### Security Vulnerabilities
- [ ] **Unauthenticated Game Create API**: `POST /api/games` endpoint in `games.py` has no authentication—anyone can create games. Add admin-only protection.
- [ ] **Achievement Unlock Without Validation**: Achievements can be unlocked via API without server-side validation of conditions. Consider server-side achievement verification.
- [ ] **Missing CORS Hardening**: Production CORS should be locked to specific origins, not rely on defaults.
- [ ] **No Input Validation on Profile Username**: `ProfileCreate` schema has no length, character set, or sanitization checks on the `username` field. Could allow XSS payloads or excessively long usernames.
- [ ] **No Score Upper Bound Validation**: `submit_score` endpoint in `stats.py` accepts any integer score with no maximum. Combined with no rate limiting, trivially exploitable.

#### Bugs
- [ ] **StellarFlight Map Switching Broken**: `StellarFlight.ts` checks `input.keys['1']`, `input.keys['2']`, `input.keys['3']` but `InputManager` stores keys by `KeyboardEvent.code` (e.g., `'Digit1'`, `'Digit2'`, `'Digit3'`). Map switching keys never match.
- [ ] **AudioManager Race Condition in `playBoot()`**: `AudioManager.ts:playBoot()` checks `this.ctx` *before* calling `this.init()`. On first call, `ctx` is `null` so the method returns early without playing anything. Move `init()` call before the guard check.
- [ ] **GameSession `end_time` Defaults to `utc_now` at Record Creation**: `session.py` model sets `end_time` default to `utc_now`, same as `start_time`. If `end_time` is never explicitly set, sessions appear to have zero duration.
- [ ] **`seed.py` Mutates `INITIAL_GAMES` Dicts**: `sync_games()` uses `.pop('achievements')` on each game dict, which mutates the module-level `INITIAL_GAMES` list. Running sync twice in the same process causes KeyError on second run.
- [ ] **Raptor Run Difficulty Modifiers Overwritten**: `RaptorRun.ts` sets `gameSpeed` via difficulty modifier in `reset()`, but `update()` unconditionally overwrites it with `Math.min(MAX_SPEED, INITIAL_SPEED + score * 0.5)`. The difficulty-adjusted speed is lost after the first frame.
- [ ] **Infinite Retry Block**: `profileStore.initialize()` short-circuits on `isInitialized` even if initialization failed (error state). No way to retry after failure. Add `force=true` param.

#### Half-Implemented Features
- [ ] **Achievements Count Hardcoded**: Profile page shows `Achievements: 124` (line 358) which is hardcoded, not fetched from API.
- [ ] **Settings.tsx Is Entirely Decorative**: Volume slider is hardcoded at 75%, latency shows hardcoded "12ms", "Clear Local Data" button has no `onClick` handler. No actual settings are persisted or applied.
- [ ] **SystemMenu "Logout" Button Has No Handler**: The "Logout" button in `SystemMenu.tsx:108` renders but has no `onClick` handler—clicking it does nothing.
- [ ] **Library Search Input Is Decorative**: `Library.tsx:75-79` renders a search input that captures user text but doesn't filter the entries list or make any API calls. Pure UI decoration.

### 🟡 High Priority

#### Code Quality Issues
- [ ] **Profile.tsx is 718 lines**: Extract components (RadarChart, TinyLineChart, SystemBar, modals) into separate files for maintainability.
- [ ] **Hardcoded UI Values in Profile.tsx**:
  - Line 358: `Achievements: "124"` - should fetch real count
  - Lines 479-485: Storage values (`4.2 GB`, `72%`) are static
  - Line 400: Firmware version hardcoded
  - Line 241: `skillMatrix.LUCK` uses `Math.random()` — changes every render
- [ ] **Hardcoded UI Values Across Multiple Components**:
  - `Layout.tsx:78`: "Online" status text is hardcoded, ignores `backendStatus` state
  - `Layout.tsx:143`: Footer version `v1.2` doesn't match actual version `1.4.1`
  - `SystemMenu.tsx:99-100`: Latency "12MS" is hardcoded
  - `Settings.tsx:37`: Volume "75%" is hardcoded
  - `Settings.tsx:62`: Latency "12ms" is hardcoded
- [ ] **Missing Error Boundaries**: Pages lack error boundaries for component-level errors. Only `GamePlayer.tsx` wraps content in `ErrorBoundary`.
- [ ] **`useGamepad` Hook Stale Closure Risk**: `useGamepad.ts` passes raw `deps` array to `useEffect` bypassing ESLint `exhaustive-deps`. Callback not in deps can cause stale closures.
- [ ] **GamepadManager Never Cleans Up Event Listeners**: `GamepadManager` constructor adds `gamepadconnected`/`gamepaddisconnected` listeners to `window` but has no `destroy()` method. Singleton pattern means these persist for app lifetime, but if the pattern ever changes, this leaks.
- [ ] **GamepadManager Logs in Production**: `GamepadManager.ts:41,46` uses `console.log` without dev-mode guard, unlike other SDK files that check `import.meta.env.DEV`.
- [ ] **Duplicate Health Check Logic**: Both `App.tsx` and `Layout.tsx` independently poll `/health` endpoint on different intervals (5s retry vs 30s polling). Should be unified into a single source of truth.

#### API Design
- [ ] **Inconsistent API Response Types**: Some endpoints return raw objects, others return wrapped responses (`{ message, entry }`). Standardize.
- [ ] **Missing Pagination**: Library and Achievements endpoints don't support pagination—could be an issue with many entries.
- [ ] **`get_session_history` Default None Parameters**: `stats.py:get_session_history` has default `None` for dependency-injected parameters (`current_user`, `db`), which is unusual for FastAPI dependencies.
- [ ] **No Playtime Upper Bound Check**: `record_session` in `stats.py` accepts arbitrarily large `playtime_seconds` values without validation.

#### Logic Issues
- [ ] **`Game` Model Cascades Too Aggressively**: All relationships on `Game` model use `cascade="all, delete-orphan"`. Deleting a game would cascade-delete all user saves, stats, achievements, and sessions.
- [ ] **`is_default` Naming Is Misleading**: `User.is_default` actually represents the *active* profile, not any notion of "default". Consider renaming to `is_active`.
- [ ] **Unused `User` Interface in API Client**: `client.ts` defines both a `User` interface (lines 29-35) and a `Profile` interface (lines 105-112) with nearly identical fields. `User` is never used—it's dead code.
- [ ] **`GameCanvas` Difficulty Change Destroys Engine**: Changing difficulty on the ready screen triggers React effect cleanup (via `difficulty` in `useEffect` deps at line 188), destroying and re-creating the entire game engine unnecessarily.
- [ ] **Save Slot Validation Gap**: `SaveCreate`/`SaveUpdate` schemas have no `ge=1, le=5` constraint on `slot` field, even though the `GameSave` model does. Validation should be at schema level first.
- [ ] **Duplicate `validate_data_size` Validators**: `SaveCreate` and `SaveUpdate` in `schemas/save.py` have identical `validate_data_size` validators. Should be extracted to a shared validator.

### 🟢 Medium Priority

#### Test Coverage Expansion
- [ ] **Backend Tests**: Add unit tests for `GameSave` logic and `Achievement` unlocking.
- [ ] **Frontend Tests**: Implement `vitest` tests for SDK core (`GameEngine`, `InputManager`).
- [ ] **API Integration Tests**: Add tests for error cases and edge conditions.
- [ ] **Vitest Setup**: Add `vitest.config.ts`, include setup file, use `vitest`-compatible `jest-dom` import.

#### Accessibility Audit
- [ ] **GameCard Keyboard Support**: `GameCard.tsx` uses `div` with `onClick` but no `tabIndex={0}`, `role="button"`, or `onKeyDown` handler. Not keyboard accessible.
- [ ] Add ARIA labels to Dashboard carousel and Game HUD.
- [ ] Implement keyboard-only navigation for Profile selector.
- [ ] Add focus indicators for all interactive elements.
- [ ] Add skip-to-content link.

#### Error Resilience
- [ ] Improved backend error handling for SQLite "Database Locked" scenarios.
- [ ] Frontend "Safe Mode" fallback for WebGL failures.
- [ ] Add retry logic for failed API calls in stores.

#### UI/UX Refinement
- [ ] Add sound effects (SFX) and background music (BGM) system to SDK.
- [ ] Implement responsive viewport scaling for 2D games on smaller screens.
- [ ] Add loading skeletons instead of spinners for smoother perceived performance.
- [ ] **`GamePlayer.tsx` Non-null Assertion on `slug`**: Line 115 uses `slug!` without a guard. If navigated to `/play/` without a slug, this would throw.
- [ ] **Achievements "Unlocked" Display Missing Timestamp**: Achievements page shows "Unlocked" label but doesn't display *when* it was unlocked (`unlocked_at` is available in the API response).

#### Persistence Improvements
- [ ] Game-specific settings persistence (e.g., volume, custom keybinds).
- [ ] Profile avatar upload support.
- [ ] Implement settings page with actual functionality (currently `Settings.tsx` is entirely static — no handlers, controls are decorative only).

#### Redundant API Calls
- [ ] **Triple Stats Fetch on Dashboard Load**: `Dashboard.tsx` calls `statsApi.getOverall()`, then `GameCarousel` (rendered inside Dashboard) independently calls `statsApi.getOverall()` again. `profileStore` also fetches stats with caching. Consolidate into store-level caching.
- [ ] **Store Search Fires on Every Keystroke**: `Store.tsx` has 300ms debounce, but both `gamesApi.list()` and `libraryApi.list()` are called together on each debounced search. Library list doesn't change with search—should only be fetched once.

### ⚪ Low Priority

#### Visual Polish
- [ ] Particle systems for Raptor Run (dust, jump effects).
- [ ] More variety in Stellar Flight maps (e.g., Saturn Rings).
- [ ] Add subtle hover animations to game cards.

#### Performance Optimization
- [ ] **Bundle Size**: Analyze and optimize Three.js imports (tree-shake unused modules).
- [ ] **Lazy Load Three.js**: Three.js (~600KB) is eagerly loaded via `games/index.ts` even when user never plays Stellar Flight. Use dynamic `import()` to lazy-load it.
- [ ] **Lazy Load Games**: Consider dynamic imports for game modules.
- [ ] **Image Optimization**: Add WebP versions of thumbnails with fallback.
- [ ] **GameCarousel Redundant API Calls**: `GameCarousel.tsx` fetches stats on every mount without leveraging store-level caching.
- [ ] **`gamesStore` No Search Debounce**: `setCategory` and `setSearchQuery` in `gamesStore.ts` immediately trigger `fetchGames()` on every call with no debounce. Rapid input fires many API requests.

#### Documentation
- [ ] **SDK README.md**: Add troubleshooting section and common patterns.
- [ ] **API Documentation**: Add OpenAPI examples and request/response samples.
- [ ] **DEVELOPMENT.md**: Update for v1.3.1, add deployment section.
- [ ] **`GameSession` Model Not Documented**: `DEVELOPMENT.md` schema overview section doesn't include the `GameSession` model.

---

## 🏗️ Technical Debt & Notes

### Architecture
- **SDK**: `LegacyGameInstance` should be deprecated once all games are updated to `Game2DInstance`/`Game3DInstance`.
- **Game Registration**: `frontend/src/games/index.ts` uses manual registration—consider auto-discovery with `import.meta.glob`.
- **Store Duplication**: `profileStore` and `libraryStore` have similar patterns—consider a base store factory.
- **`FocusContext` Half-Implemented**: Navigation logic only supports hardcoded `nav` and `ribbon` groups. Not generic enough for reuse.
- **No Shared Types**: Frontend types in `client.ts` are manually mirrored from backend schemas. No codegen = inevitable type drift.
- **`axios` vs `fetch`**: `axios` adds ~15KB. For a local app with simple REST, built-in `fetch` suffices.
- **Dual Dependency Files**: Backend has both `requirements.txt` and `pyproject.toml`/`uv.lock`. Only one should be canonical.
- **InputManager Only Supports Player 1**: `InputManager.ts` and `GamepadManager.ts` only process `gamepads[0]`. Multi-gamepad not supported.

### Security
- Ensure `SECRET_KEY` is enforced in production environments.
- Add rate limiting for score submission endpoints to prevent cheating.
- Consider input sanitization beyond LIKE pattern escaping.
- No input validation on profile `username` field (no length, character, or sanitization checks).

### Database
- Consider Alembic for proper migrations instead of ad-hoc scripts.
- Add indexes for frequently queried columns (`last_played`, `last_session`).

### Code Consistency
- ~~Standardize datetime handling~~ — Consolidated to `app/datetime_utils.py`.
- Unify error handling patterns across routers.
- Add ESLint rules for import ordering.
- Inconsistent dev-mode logging: Some SDK files guard `console.log` with `import.meta.env.DEV`, others (`GamepadManager`) don't.
- `API_BASE_URL` in `client.ts` includes `/api` suffix, but health check URLs in `App.tsx` and `Layout.tsx` use the raw base URL without `/api`. This split is fragile.

---
