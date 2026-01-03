# Changelog

All notable changes to Arcade Nexus will be documented in this file.

## [1.1.0] - 2026-01-03

### 🔧 Stability & Performance Update

#### Security
- **Session Persistence** - Fixed `SECRET_KEY` generation to persist across server restarts, preventing user logout
- **URL Robustness** - Improved API client configuration for better environment compatibility

#### Performance
- **Backend Optimizations** - Replaced inefficient Python-side filtering with direct SQL `COUNT` and `UPDATE` queries in `profiles.py`
- **Frontend Caching** - Implemented 60-second stats caching to reduce redundant network requests on tab switches

#### UI/UX
- **Loading States** - Added proper loading animation for Dashboard game carousel
- **Local Assets** - Replaced external thumbnail Dependencies with local SVG assets for offline reliability
- **Mobile Support** - Added basic touch handling for canvases

#### Code Quality
- **Refactoring** - Extracted utility functions and improved `GameSDK` type definitions
- **Testing** - Added complete testing infrastructure (`pytest` for backend, `vitest` for frontend)

## [1.0.0] - 2024-12-14

### 🎮 Initial Release

**Arcade Nexus** - A premium local arcade gaming console built with React, FastAPI, and a custom Game SDK.

### Features

#### Core Platform
- **Aether OS Interface** - Sleek console-style UI with glassmorphism and dynamic theming
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
- **Stellar Drift** - 3D space adventure with boost mechanics
- **Sky Ace** - High-altitude flight simulator

#### Backend
- **FastAPI** - Async Python backend with SQLAlchemy
- **Auto-seeding** - Database populates on first run
- **RESTful API** - Games, profiles, stats, saves, library, achievements

#### UI/UX
- **Fullscreen Gaming** - Zero-distraction gameplay experience
- **Backend Status** - Live indicator shows server connection
- **Difficulty Settings** - Easy, Normal, Hard modes per game
- **Responsive Design** - Adapts to all desktop screen sizes
- **Hidden Scrollbars** - Clean aesthetic throughout

### Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, SQLite, Uvicorn |
| 3D | Three.js |
| State | Zustand |
| API | Axios |
