# Arcade Nexus - Tasks

> **Project:** Arcade Nexus  
> **Version:** 1.3.0  
> **Last Updated:** 2026-01-12

---

## 🚧 In Progress

### Games
- [/] **Stellar Flight** - 3D flight game
  - [x] Scene setup, map switching, 6-DOF controller
  - [x] Keyboard controls and hints
  - [ ] **Collision Detection**: Implement terrain and boundary collision (CRITICAL: currently fly through ground).
  - [ ] **Scoring System**: Replace speed placeholder with distance/time/objective scoring.
  - [ ] **Game Over Loop**: Implement crash state and score submission integration.

---

## 📋 To Do

### 🔴 High Priority
- [ ] **Test Coverage Expansion**:
  - [ ] Backend: Add unit tests for `GameSave` logic and `Achievement` unlocking.
  - [ ] Frontend: Implement `vitest` for SDK core (GameEngine, InputManager).
- [ ] **Accessibility Audit**:
  - [ ] Add ARIA labels to Dashboard carousel and Game HUD.
  - [ ] Implement keyboard-only navigation for Profile selector.
- [ ] **Error Resilience**:
  - [ ] Improved backend error handling for SQLite "Database Locked" scenarios.
  - [ ] Frontend "Safe Mode" for WebGL failures.

### 🟡 Medium Priority
- [ ] **UI Refinement**:
  - [ ] Add sound effects (SFX) and background music (BGM) system to SDK.
  - [ ] Implement responsive viewport scaling for 2D games on smaller screens.
- [ ] **Persistence Improvements**:
  - [ ] Game-specific settings persistence (e.g., volume, custom keybinds).
  - [ ] Profile avatar upload support.

### 🟢 Low Priority
- [ ] **Visual Polish**:
  - [ ] Particle systems for Raptor Run (dust, jump effects).
  - [ ] More variety in Stellar Flight maps (e.g., Saturn Rings).

---

## 🏗️ Technical Debt & Notes
- **SDK**: `LegacyGameInstance` should be deprecated once all games are updated to `Game2DInstance`/`Game3DInstance`.
- **Security**: Ensure `SECRET_KEY` is enforced in production environments.
- **Complexity**: Game registration in `frontend/src/games/index.ts` works but could be dynamic for auto-discovery.
