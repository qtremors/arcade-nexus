# Arcade Nexus Changelog

> **Project:** Arcade Nexus  
> **Version:** 1.4.0  
> **Last Updated:** 2026-01-16

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
