# Arcade Nexus - Backlog

## 🔴 Critical Bugs

- [ ] **ESLint Errors (13 errors, 3 warnings)** - Must fix before production
  - Unused imports (e.g., `Check` in Store.tsx)
  - Run `npm run lint` in frontend to see full list

---

## 🟡 Dead Code / Unused Components

- [ ] `frontend/src/components/console/GameRibbon.tsx` - Exported but never imported anywhere
- [ ] `frontend/src/components/console/HeroBackground.tsx` - Exported but never imported anywhere  
- [ ] `frontend/src/pages/Boot.tsx` - Uses framer-motion but not imported/used (BootSequence.tsx is used instead)

---

## 🟠 Logic Issues & Inconsistencies

- [ ] **Difficulty setting not wired to games** - `GameCanvas` passes difficulty to games via config, but games (Snake, RaptorRun, SpaceRunner) don't read or use the `config.difficulty` value
- [ ] **GameCanvas restart duplicates callback logic** - Lines 84-111 and 170-195 have identical callback setup code that should be extracted to a helper function
- [ ] **Profile store uses is_default for active profile** - This conflates "default" with "active" semantically; consider renaming for clarity

---

## 🔵 Half-Baked / Incomplete Features

- [ ] **Save/Load UI not implemented** - Backend has full save/load API (`/api/saves/*`), frontend has `savesApi`, but no UI to save/load game states
- [ ] **Achievements UI not implemented** - Backend has achievements API, games don't unlock achievements, no UI to display them
- [ ] **Store filter buttons are stubs** - "All Categories" and "Top Rated" buttons in Store.tsx have no functionality
- [ ] **Category filter in gamesApi not used** - API supports category filtering but Store page doesn't use it

---

## 📱 UI/UX Improvements

- [ ] **No loading state indicator for game carousel navigation** - Dashboard switches instantly but could show subtle transition feedback
- [ ] **Boot sequence uses BootSequence.tsx not Boot.tsx** - Clean up the duplicate/unused Boot.tsx page
- [ ] **Game thumbnails are placeholder/null** - Games have `thumbnail: null` in seed data; need actual thumbnails

---

## ⚡ Performance & Efficiency

- [ ] **GameCanvas has inline styles** - 100+ lines of inline `style={{}}` objects; consider extracting to CSS or styled components
- [ ] **Profile page reloads stats on every visit** - Could cache stats in zustand store

---

## 📚 Documentation

- [ ] **SDK README is excellent** - 434 lines of comprehensive documentation ✅
- [ ] **README.md is good** - Could add troubleshooting section for common issues
- [ ] **No API documentation beyond README** - Consider adding OpenAPI/Swagger UI (FastAPI has built-in support at `/docs`)

---

## 🧪 Testing & Quality

- [ ] Create `backend/tests/` directory and add pytest tests for API endpoints
- [ ] Add frontend unit tests (Vitest/Jest)
- [ ] Add E2E tests for critical user flows (Playwright suggested)

---

## ✨ Future Features

- [ ] Sound effects and music
- [ ] Touchscreen controls / mobile support
- [ ] More games (Tetris, Breakout, etc.)
- [ ] Achievements system UI with unlock notifications
- [ ] Game thumbnails gallery view
- [ ] Export/import save data (JSON backup/restore)
- [ ] Leaderboards (global high scores across profiles)
- [ ] Gamepad support enhancement (currently basic via InputManager)

---

## 🛠️ Technical Debt

- [ ] **Fix all ESLint errors** - 13 errors, 3 warnings currently
- [ ] **Remove dead code** - Delete unused components listed above
- [ ] **Consolidate Boot components** - Keep BootSequence.tsx, remove Boot.tsx
- [ ] **Extract GameCanvas callback setup** - DRY up the duplicate code
- [ ] **Add proper TypeScript strict mode** - Enable stricter checks
- [ ] **Improve error handling** - Replace console.error with user-friendly error toasts/notifications
