# Arcade Nexus - Tasks

> **Project:** Arcade Nexus  
> **Version:** 1.4.1
> **Last Updated:** 2026-02-11

---

## 📋 To Do

### 🔴 Critical Priority

#### Security Vulnerabilities
- [ ] **Unauthenticated Game Create API**: `POST /api/games` endpoint in `games.py` has no authentication—anyone can create games. Add admin-only protection.
- [ ] **Achievement Unlock Without Validation**: Achievements can be unlocked via API without server-side validation of conditions. Consider server-side achievement verification.
- [ ] **Missing CORS Hardening**: Production CORS should be locked to specific origins, not rely on defaults.

#### Half-Implemented Features
- [ ] **Achievements Count Hardcoded**: Profile page shows `Achievements: 124` (line 358) which is hardcoded, not fetched from API.

### 🟡 High Priority

#### Dead & Unused Code
- [x] **Unused Import in games.py**: `import re` (line 4) is never used—remove it.
- [x] **Duplicate `utc_now()` Functions**: Defined in 6+ model files. Extracted to `app/datetime_utils.py` for DRY.
- [x] **Duplicate `formatPlaytime()` Function**: Defined in both `utils/formatting.ts` (canonical) and inline in `GameCarousel.tsx`. Removed the inline duplicate.
- [x] **Legacy `add_column.py`**: Standalone migration script in backend root—removed.
- [x] **AtmosphereOverlay.tsx Dead Code**: Component returned `null` with zero imports—removed.

#### Code Quality Issues
- [ ] **Profile.tsx is 718 lines**: Extract components (RadarChart, TinyLineChart, SystemBar, modals) into separate files for maintainability.
- [ ] **Hardcoded UI Values in Profile.tsx**:
  - Line 358: `Achievements: "124"` - should fetch real count
  - Lines 479-485: Storage values (`4.2 GB`, `72%`) are static
  - Line 400: Firmware version hardcoded
  - Line 241: `skillMatrix.LUCK` uses `Math.random()` — changes every render
- [x] **Old Log Name**: `StellarFlight.ts:77` logs `[AetherFlight]` instead of `[StellarFlight]`—fixed.
- [ ] **Missing Error Boundaries**: Pages lack error boundaries for component-level errors.
- [ ] **`useGamepad` Hook Stale Closure Risk**: `useGamepad.ts` passes raw `deps` array to `useEffect` bypassing ESLint `exhaustive-deps`. Callback not in deps can cause stale closures.
- [x] **`@types/three` in Production Dependencies**: Type-only dev dependency moved to `devDependencies` in `package.json`.

#### API Design
- [ ] **Inconsistent API Response Types**: Some endpoints return raw objects, others return wrapped responses (`{ message, entry }`). Standardize.
- [ ] **Missing Pagination**: Library and Achievements endpoints don't support pagination—could be an issue with many entries.

### 🟢 Medium Priority

#### Test Coverage Expansion
- [ ] **Backend Tests**: Add unit tests for `GameSave` logic and `Achievement` unlocking.
- [ ] **Frontend Tests**: Implement `vitest` tests for SDK core (`GameEngine`, `InputManager`).
- [ ] **API Integration Tests**: Add tests for error cases and edge conditions.

#### Accessibility Audit
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

#### Persistence Improvements
- [ ] Game-specific settings persistence (e.g., volume, custom keybinds).
- [ ] Profile avatar upload support.
- [ ] Implement settings page with actual functionality (currently `Settings.tsx` is entirely static — no handlers, controls are decorative only).

###  Low Priority

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

#### Documentation
- [ ] **SDK README.md**: Add troubleshooting section and common patterns.
- [ ] **API Documentation**: Add OpenAPI examples and request/response samples.
- [ ] **DEVELOPMENT.md**: Update for v1.3.1, add deployment section.

### 🐇 PR Review Feedback (CodeRabbit)

#### Critical Fixes
- [x] **Unsafe Debug Default**: `backend/app/config.py`: Changed `DEBUG` default to `False`.
- [x] **Unsafe API Defaults**: `backend/app/routers/stats.py`: Removed dangerous `= ...` defaults for dependencies.
- [x] **React Hook Rules**: `frontend/src/components/SessionHistoryModal.tsx`: Moved early return below hooks.
- [ ] **Infinite Retry Block**: `frontend/src/App.tsx`: `profileStore.initialize()` short-circuits if already init (even if failed). Add `force=true` param to allow retries.

#### Quality & Logic
- [ ] **Raptor Run Difficulty Reset**: `frontend/src/games/raptor-run/RaptorRun.ts`: Modifiers are overwritten in `update()`. Persist `speedModifier`/`spawnModifier` in class fields.
- [ ] **AudioManager Race Condition**: `frontend/src/sdk/AudioManager.ts`: `playBoot()` checks `ctx` before `init()`. Move `init()` call up.
- [x] **Gamepad Crash**: `frontend/src/components/arcus/GameCarousel.tsx`: Added guard for empty `games` array.

#### Testing & Tooling
- [ ] **Vitest Setup**: `frontend/src/__tests__/setup.ts`: Add `vitest.config.ts`, include setup file, use `vitest` compatible `jest-dom` import.

#### Accessibility & UX
- [ ] **GameCard Keyboard Support**: `frontend/src/components/arcus/GameCard.tsx`: Add `tabIndex={0}`, `role="button"`, `onKeyDown` (Space/Enter). Add ARIA labels.
- [x] **Prod Error Leaks**: `frontend/src/components/ErrorBoundary.tsx`: Raw error hidden in production.

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

---
