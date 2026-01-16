# Arcade Nexus - Tasks

> **Project:** Arcade Nexus  
> **Version:** 1.4.0
> **Last Updated:** 2026-01-16

---

## 🚧 In Progress

### Games
- [/] **Stellar Flight** - 3D flight game
  - [x] Scene setup, map switching, 6-DOF controller
  - [x] Keyboard controls and hints
  - [ ] **Collision Detection**: Implement terrain and boundary collision (CRITICAL: currently fly through ground).
  - [ ] **Scoring System**: Replace speed placeholder with distance/time/objective scoring (line 149-150 in `StellarFlight.ts`).
  - [ ] **Game Over Loop**: Implement crash state and score submission integration.

---

## 📋 To Do

### 🔴 Critical Priority

#### Bugs & Logical Errors
- [x] **Backend Version Mismatch**: `config.py` shows `APP_VERSION = "1.2.0"` but CHANGELOG/README indicate v1.4.0. Update to match.
- [ ] **Stats Router Parameter Bug**: In `stats.py:94-98`, `current_user` and `db` have `= None` defaults which can cause runtime errors if FastAPI dependency injection fails.
- [ ] **SQLite Connection Pooling**: `database.py` uses `pool_size=20` and `max_overflow=30` but SQLite doesn't support true connection pooling. Consider using `StaticPool` or removing pool options for SQLite.

#### Security Vulnerabilities
- [ ] **Unauthenticated Game Create API**: `POST /api/games` endpoint in `games.py` has no authentication—anyone can create games. Add admin-only protection.
- [ ] **Achievement Unlock Without Validation**: Achievements can be unlocked via API without server-side validation of conditions. Consider server-side achievement verification.
- [ ] **Missing CORS Hardening**: Production CORS should be locked to specific origins, not rely on defaults.

#### Half-Implemented Features
- [ ] **Stellar Flight Missing Core Features**: No collision, no game over state, no real scoring—game is essentially a flyover demo.
- [ ] **Achievements Count Hardcoded**: Profile page shows `Achievements: 124` (line 358) which is hardcoded, not fetched from API.

### 🟡 High Priority

#### Dead & Unused Code
- [ ] **Unused Import in games.py**: `import re` (line 4) is never used—remove it.
- [ ] **Duplicate `utc_now()` Functions**: Defined in `user.py`, `game.py`, and `stats.py`. Extract to `utils/datetime.py` for DRY.
- [ ] **Legacy `add_column.py`**: Standalone migration script in backend root—consider removing or integrating into migrations.
- [ ] **AtmosphereOverlay.tsx Empty Export**: File contains only `export {};`—dead code that should be removed.

#### Code Quality Issues
- [ ] **Profile.tsx is 718 lines**: Extract components (RadarChart, TinyLineChart, SystemBar, modals) into separate files for maintainability.
- [ ] **Hardcoded UI Values in Profile.tsx**:
  - Line 358: `Achievements: "124"` - should fetch real count
  - Lines 479-485: Storage values (`4.2 GB`, `72%`) are static
  - Line 400: Firmware version hardcoded
- [ ] **Old Log Name**: `StellarFlight.ts:77` logs `[AetherFlight]` instead of `[StellarFlight]`.
- [ ] **Missing Error Boundaries**: Pages lack error boundaries for component-level errors.

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
- [ ] Implement settings page with actual functionality (currently `Settings.tsx` is minimal).

###  Low Priority

#### Visual Polish
- [ ] Particle systems for Raptor Run (dust, jump effects).
- [ ] More variety in Stellar Flight maps (e.g., Saturn Rings).
- [ ] Add subtle hover animations to game cards.

#### Performance Optimization
- [ ] **Bundle Size**: Analyze and optimize Three.js imports (tree-shake unused modules).
- [ ] **Lazy Load Games**: Consider dynamic imports for game modules.
- [ ] **Image Optimization**: Add WebP versions of thumbnails with fallback.

#### Documentation
- [ ] **SDK README.md**: Add troubleshooting section and common patterns.
- [ ] **API Documentation**: Add OpenAPI examples and request/response samples.
- [ ] **DEVELOPMENT.md**: Update for v1.3.1, add deployment section.

---

## 🏗️ Technical Debt & Notes

### Architecture
- **SDK**: `LegacyGameInstance` should be deprecated once all games are updated to `Game2DInstance`/`Game3DInstance`.
- **Game Registration**: `frontend/src/games/index.ts` uses manual registration—consider auto-discovery with `import.meta.glob`.
- **Store Duplication**: `profileStore` and `libraryStore` have similar patterns—consider a base store factory.

### Security
- Ensure `SECRET_KEY` is enforced in production environments.
- Add rate limiting for score submission endpoints to prevent cheating.
- Consider input sanitization beyond LIKE pattern escaping.

### Database
- Consider Alembic for proper migrations instead of ad-hoc scripts.
- Add indexes for frequently queried columns (`last_played`, `last_session`).

### Code Consistency
- Standardize datetime handling (all should use `timezone.utc`).
- Unify error handling patterns across routers.
- Add ESLint rules for import ordering.

---
