# Arcade Nexus - Tasks

> **Project:** Arcade Nexus  
> **Version:** 1.3.0  
> **Last Updated:** 2026-01-12

---

## 🚧 In Progress

### Games

- [/] **Stellar Flight** - 3D flight game (Marked "Coming Soon" in Store)
  - [x] Three.js scene setup with GLTF loader
  - [x] Map switching (Earth, Mars, Space)
  - [x] Basic flight controller with 6-DOF
  - [x] Keyboard controls fixed
  - [x] Control hints added
  - [ ] **Scoring system** - Currently just speed-based placeholder
  - [ ] **Collision detection** - None implemented
  - [ ] **Game over condition** - Always returns `true` in update()

---

## 📋 To Do

### High Priority

- [ ] Complete Stellar Flight game loop
  - [ ] Add actual game over condition (crash into ground, fly out of bounds)
  - [ ] Implement proper scoring (distance, time, rings)
  - [ ] Add collision detection with terrain

### Low Priority

- [ ] Sound effects and background music
- [ ] Custom profile avatars upload
- [ ] Game-specific settings persistence

---

## 🏗️ Architecture Notes

### Current Strengths
- Clean separation between SDK and game implementations
- Proper async/await patterns in backend
- Zustand stores are well-structured with caching
- Both 2D games (Snake, RaptorRun) properly wire difficulty settings
- Fully offline-capable
- Toast notification system for user feedback
- Snake game has visible border for play area

---