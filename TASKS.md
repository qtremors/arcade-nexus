# Arcade Nexus Task Backlog

> **Version:** 0.5.2 | **Last Updated:** 2026-10-20

Only unfinished work is listed. Acceptance must be recorded on the actual named devices or with the relevant people; software-rendered automation does not close these items.

## Windows Baseline Verification

- [ ] **BUG-0001 - Verify Windows SQLite URL Round Trips and Test Paths**
  - **Location:** `backend/app/config.py`; `backend/tests/test_config.py`, `test_database.py`, `test_contracts.py`, `test_history.py`, `test_progress.py`, and `test_backup.py`.
  - **Current:** The original and reorganized trees reproduce the same Windows failures involving serialized drive letters, native path comparisons, and direct SQLite fixture connections.
  - **Change:** Separate test portability assumptions from runtime URL handling, then fix each reproduced cause in a dedicated behavior-change task.
  - **Acceptance:** Windows URL round trips open the intended file, isolated fixtures remain isolated, and the affected tests pass without weakening their assertions.

- [ ] **BUG-0002 - Preserve API 404 Responses in Windows Static Serving**
  - **Location:** `backend/app/main.py`; `backend/tests/test_progress.py::test_production_static_routes_keep_api_errors_and_serve_deep_links`.
  - **Current:** The original and reorganized trees both return the SPA document with status 200 for `/api/missing` in the Windows static-serving regression.
  - **Change:** Investigate normalized route paths and preserve unknown API routes as 404 responses in a separate bug fix.
  - **Acceptance:** Known frontend deep links return the document, missing assets remain 404, and unknown API paths never receive the SPA fallback.

## Hardware and Performance

- [ ] **H1 - Verify Native Full HD Performance and Resource Use**
  - **Location:** `scripts/laptop_check.py`; `frontend/scripts/benchmark-games.mjs`; game renderers.
  - **Current:** Software-rendering regression evidence exists; native power, thermals, latency, and long-run GPU behavior remain unverified.
  - **Change:** Run visible diagnostics on named integrated and dedicated GPUs on AC and battery.
  - **Acceptance:** Record hardware/OS/browser, renderer, Full HD buffers, frame-time percentiles, sustained resource trends, power/thermals, physical input latency, and any failures.

## Controllers and Platforms

- [ ] **H2 - Verify Physical Controllers and Target Platforms**
  - **Location:** `frontend/src/shared/input`; `frontend/src/features/session`; `frontend/e2e`.
  - **Current:** Automated controller routing exists; wired/Bluetooth devices and target OS/browser combinations still need observation.
  - **Change:** Exercise onboarding, menus, every game, reconnect, disconnect pause, and controller handover on real devices.
  - **Acceptance:** Record device/browser combinations and complete controller-only onboarding and session journeys without focus traps or lost controls.

## Accessibility

- [ ] **H3 - Verify Real Zoom and Assistive Technology**
  - **Location:** Shared UI, feature styles, `frontend/src/games/merge-2048/BoardReader.ts`.
  - **Current:** Automated accessibility and narrow-layout coverage exists; real magnification and assistive technology remain unverified.
  - **Change:** Test browser zoom, OS magnification, keyboard navigation, screen reading, and 2048's semantic controls.
  - **Acceptance:** Record software/device settings, readable content, reachable controls, announcements, focus order, and any remaining barriers.

## Gameplay

- [ ] **H4 - Run Unfamiliar-Player Playtests**
  - **Location:** `frontend/src/games`; launch/control guides; shared catalog.
  - **Current:** Deterministic rule coverage exists; unfamiliar-player clarity, fairness, and replay interest require human observation.
  - **Change:** Observe sessions across all eight games, representative modes/difficulties, saves, Continue, and completion.
  - **Acceptance:** Record participants' familiarity, control confusion, mode completion, difficulty issues, and voluntary replay without substituting automation for feedback.

---

Protocols and technical context are in [DEVELOPMENT.md](DEVELOPMENT.md#performance-and-hardware-acceptance).
