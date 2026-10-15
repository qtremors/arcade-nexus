# File-by-file review ledger

Historical ledger for the reviewed snapshot. Subsequent implementation and new modules are tracked in [REVIEW_FOLLOWUP.md](REVIEW_FOLLOWUP.md).

Reviewed on `ag-dev`, 2026-10-14. Findings and scenario limits are in [DEEP_REVIEW.md](DEEP_REVIEW.md).

The starting snapshot had 252 maintained files (40,801 text lines). This ledger covers **261 paths**, including the added regression tests and review artifacts. Generated builds, dependency internals and ignored user data are excluded. “Source” means source inspection; test, stylesheet, asset, report and lock checks use the distinct methods shown. No finding number means no additional confirmed defect was recorded for that file in this pass; it does not mean every future input is proven safe.

| File | Review method | Focus / outcome |
| --- | --- | --- |
| [.gitignore](../.gitignore) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [CHANGELOG.md](../CHANGELOG.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [DEVELOPMENT.md](../DEVELOPMENT.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [LICENSE.md](../LICENSE.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [README.md](../README.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [TASKS.md](../TASKS.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [arcade.py](../arcade.py) | Source | R5 fixed: direct Vite process, prerequisites and shutdown. |
| [backend/.env.example](../backend/.env.example) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/.python-version](../backend/.python-version) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/README.md](../backend/README.md) | Documentation / contract consistency | Corrected legacy session-counter description; current setup, data paths and API boundaries. |
| [backend/REVIEW.md](../backend/REVIEW.md) | Documentation / contract consistency | Historical review labelled; current contracts linked, old validation retained as history. |
| [backend/alembic.ini](../backend/alembic.ini) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/app/__init__.py](../backend/app/__init__.py) | Source | Exports/registration checked against real imports and lazy-loading contracts. |
| [backend/app/config.py](../backend/app/config.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/app/database.py](../backend/app/database.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/app/datetime_utils.py](../backend/app/datetime_utils.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/app/dependencies.py](../backend/app/dependencies.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/app/game_rules.py](../backend/app/game_rules.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/app/main.py](../backend/app/main.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/app/middleware.py](../backend/app/middleware.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/app/migrate.py](../backend/app/migrate.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/app/models/__init__.py](../backend/app/models/__init__.py) | Source | Columns/defaults, relationship ownership, uniqueness/check constraints, timestamps and migration parity. |
| [backend/app/models/achievement.py](../backend/app/models/achievement.py) | Source | Columns/defaults, relationship ownership, uniqueness/check constraints, timestamps and migration parity. |
| [backend/app/models/game.py](../backend/app/models/game.py) | Source | Columns/defaults, relationship ownership, uniqueness/check constraints, timestamps and migration parity. |
| [backend/app/models/library.py](../backend/app/models/library.py) | Source | Columns/defaults, relationship ownership, uniqueness/check constraints, timestamps and migration parity. |
| [backend/app/models/progress.py](../backend/app/models/progress.py) | Source | Columns/defaults, relationship ownership, uniqueness/check constraints, timestamps and migration parity. |
| [backend/app/models/save.py](../backend/app/models/save.py) | Source | Columns/defaults, relationship ownership, uniqueness/check constraints, timestamps and migration parity. |
| [backend/app/models/session.py](../backend/app/models/session.py) | Source | Columns/defaults, relationship ownership, uniqueness/check constraints, timestamps and migration parity. |
| [backend/app/models/stats.py](../backend/app/models/stats.py) | Source | Columns/defaults, relationship ownership, uniqueness/check constraints, timestamps and migration parity. |
| [backend/app/models/user.py](../backend/app/models/user.py) | Source | Columns/defaults, relationship ownership, uniqueness/check constraints, timestamps and migration parity. |
| [backend/app/routers/__init__.py](../backend/app/routers/__init__.py) | Source | Ownership, input validation, query bounds/order, transaction/error paths and endpoint callers. |
| [backend/app/routers/achievements.py](../backend/app/routers/achievements.py) | Source | Ownership, input validation, query bounds/order, transaction/error paths and endpoint callers. |
| [backend/app/routers/data.py](../backend/app/routers/data.py) | Source | R1/R3/R15 fixed: saved UUIDs, wrappers, reservations; transactional copies and bounded export queries. |
| [backend/app/routers/games.py](../backend/app/routers/games.py) | Source | Ownership, input validation, query bounds/order, transaction/error paths and endpoint callers. |
| [backend/app/routers/library.py](../backend/app/routers/library.py) | Source | Ownership, input validation, query bounds/order, transaction/error paths and endpoint callers. |
| [backend/app/routers/profiles.py](../backend/app/routers/profiles.py) | Source | Ownership, input validation, query bounds/order, transaction/error paths and endpoint callers. |
| [backend/app/routers/progress.py](../backend/app/routers/progress.py) | Source | R11 fixed: terminal cleanup/late checkpoints; receipts, records, awards and filters. |
| [backend/app/routers/saves.py](../backend/app/routers/saves.py) | Source | Ownership, input validation, query bounds/order, transaction/error paths and endpoint callers. |
| [backend/app/routers/stats.py](../backend/app/routers/stats.py) | Source | R2 fixed: legacy standalone counter; replay/ownership and concurrent updates. |
| [backend/app/schemas/__init__.py](../backend/app/schemas/__init__.py) | Source | Request/response shape, strictness, finite JSON, limits and compatibility with API callers. |
| [backend/app/schemas/achievement.py](../backend/app/schemas/achievement.py) | Source | Request/response shape, strictness, finite JSON, limits and compatibility with API callers. |
| [backend/app/schemas/base.py](../backend/app/schemas/base.py) | Source | Request/response shape, strictness, finite JSON, limits and compatibility with API callers. |
| [backend/app/schemas/game.py](../backend/app/schemas/game.py) | Source | Request/response shape, strictness, finite JSON, limits and compatibility with API callers. |
| [backend/app/schemas/library.py](../backend/app/schemas/library.py) | Source | Request/response shape, strictness, finite JSON, limits and compatibility with API callers. |
| [backend/app/schemas/save.py](../backend/app/schemas/save.py) | Source | Request/response shape, strictness, finite JSON, limits and compatibility with API callers. |
| [backend/app/schemas/stats.py](../backend/app/schemas/stats.py) | Source | R11 additive ended metric; bounded numeric/result contracts. |
| [backend/app/schemas/user.py](../backend/app/schemas/user.py) | Source | Request/response shape, strictness, finite JSON, limits and compatibility with API callers. |
| [backend/app/seed.py](../backend/app/seed.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/app/services/__init__.py](../backend/app/services/__init__.py) | Source | Exports/registration checked against real imports and lazy-loading contracts. |
| [backend/app/services/backups.py](../backend/app/services/backups.py) | Source | R4 fixed: clock rollback and fresh-copy retention; atomic writes, owned paths, scheduling. |
| [backend/app/services/common.py](../backend/app/services/common.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/app/services/history.py](../backend/app/services/history.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/app/utils/__init__.py](../backend/app/utils/__init__.py) | Source | Exports/registration checked against real imports and lazy-loading contracts. |
| [backend/app/utils/local_user.py](../backend/app/utils/local_user.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/migrations/env.py](../backend/migrations/env.py) | Source | Schema chain, legacy adoption/rollback and data preservation; applied revisions left intact. |
| [backend/migrations/script.py.mako](../backend/migrations/script.py.mako) | Source | Schema chain, legacy adoption/rollback and data preservation; applied revisions left intact. |
| [backend/migrations/versions/0001_baseline_the_existing_v1_4_1_database.py](../backend/migrations/versions/0001_baseline_the_existing_v1_4_1_database.py) | Source | Schema chain, legacy adoption/rollback and data preservation; applied revisions left intact. |
| [backend/migrations/versions/0002_add_durable_session_identities_and_.py](../backend/migrations/versions/0002_add_durable_session_identities_and_.py) | Source | Schema chain, legacy adoption/rollback and data preservation; applied revisions left intact. |
| [backend/migrations/versions/0003_add_session_metrics.py](../backend/migrations/versions/0003_add_session_metrics.py) | Source | Schema chain, legacy adoption/rollback and data preservation; applied revisions left intact. |
| [backend/migrations/versions/0004_progress.py](../backend/migrations/versions/0004_progress.py) | Source | Schema chain, legacy adoption/rollback and data preservation; applied revisions left intact. |
| [backend/pyproject.toml](../backend/pyproject.toml) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/requirements.txt](../backend/requirements.txt) | Lock/export consistency | Resolved structure, manifest/runtime-export parity and offline lock validity; no fresh advisory-feed claim. |
| [backend/run.py](../backend/run.py) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [backend/tests/conftest.py](../backend/tests/conftest.py) | Test contracts / execution | Fixtures/assertions and real temporary-database regression behavior; executed by pytest. |
| [backend/tests/test_achievements.py](../backend/tests/test_achievements.py) | Test contracts / execution | Fixtures/assertions and real temporary-database regression behavior; executed by pytest. |
| [backend/tests/test_api.py](../backend/tests/test_api.py) | Test contracts / execution | Fixtures/assertions and real temporary-database regression behavior; executed by pytest. |
| [backend/tests/test_backup.py](../backend/tests/test_backup.py) | Test contracts / execution | R1/R15 regressions; scoped export, fixed query count, UUID remapping and reserved starts. |
| [backend/tests/test_catalog.py](../backend/tests/test_catalog.py) | Test contracts / execution | Fixtures/assertions and real temporary-database regression behavior; executed by pytest. |
| [backend/tests/test_config.py](../backend/tests/test_config.py) | Test contracts / execution | Fixtures/assertions and real temporary-database regression behavior; executed by pytest. |
| [backend/tests/test_database.py](../backend/tests/test_database.py) | Test contracts / execution | Fixtures/assertions and real temporary-database regression behavior; executed by pytest. |
| [backend/tests/test_history.py](../backend/tests/test_history.py) | Test contracts / execution | Fixtures/assertions and real temporary-database regression behavior; executed by pytest. |
| [backend/tests/test_profiles.py](../backend/tests/test_profiles.py) | Test contracts / execution | Fixtures/assertions and real temporary-database regression behavior; executed by pytest. |
| [backend/tests/test_progress.py](../backend/tests/test_progress.py) | Test contracts / execution | R11 regressions; terminal loss versus resumable quit, late writes and newer runs. |
| [backend/tests/test_rotating_backups.py](../backend/tests/test_rotating_backups.py) | Test contracts / execution | R3/R4 regressions; malformed wrappers, clock rollback, atomic retention and previews. |
| [backend/tests/test_saves.py](../backend/tests/test_saves.py) | Test contracts / execution | Fixtures/assertions and real temporary-database regression behavior; executed by pytest. |
| [backend/tests/test_stats.py](../backend/tests/test_stats.py) | Test contracts / execution | R2 regression; start/no-start/replay totals, ownership and concurrency. |
| [backend/uv.lock](../backend/uv.lock) | Lock/export consistency | Resolved structure, manifest/runtime-export parity and offline lock validity; no fresh advisory-feed claim. |
| [catalog.json](../catalog.json) | Source | Eight loader/seed-aligned definitions; modes, ranking, rules versions and valid tuning. |
| [docs/ARCHITECTURE_REVIEW.md](../docs/ARCHITECTURE_REVIEW.md) | Architecture / responsibility and dependency analysis | A1–A8: quantified hotspots, contract mismatch, ownership boundaries, staged recommendations and preservation checks. |
| [docs/DEEP_REVIEW.md](../docs/DEEP_REVIEW.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [docs/GAME_IMPROVEMENTS.md](../docs/GAME_IMPROVEMENTS.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [docs/PERFORMANCE.md](../docs/PERFORMANCE.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [docs/PLAYTEST.md](../docs/PLAYTEST.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [docs/PLAY_REVIEW.md](../docs/PLAY_REVIEW.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [docs/RELIABILITY.md](../docs/RELIABILITY.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [docs/REVIEW_FILES.md](../docs/REVIEW_FILES.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [docs/SIX_IMPROVEMENTS.md](../docs/SIX_IMPROVEMENTS.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [docs/VALIDATION.md](../docs/VALIDATION.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [docs/architecture-metrics.json](../docs/architecture-metrics.json) | AST / OpenAPI / stylesheet measurements | Module graph, size/function/class metrics, source digest, API response schemas, concrete nullability mismatch and style ownership. |
| [docs/performance/cloud-adaptive-experiment.json](../docs/performance/cloud-adaptive-experiment.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/cloud-before.json](../docs/performance/cloud-before.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/cloud-full-hd.json](../docs/performance/cloud-full-hd.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/cloud-resource-before.json](../docs/performance/cloud-resource-before.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/cloud-resource-optimized.json](../docs/performance/cloud-resource-optimized.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/cloud-resource-wide.json](../docs/performance/cloud-resource-wide.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/cloud-six-2d-compositor-experiment.json](../docs/performance/cloud-six-2d-compositor-experiment.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/cloud-six-2d.json](../docs/performance/cloud-six-2d.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/cloud-six-improvements.json](../docs/performance/cloud-six-improvements.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/flight-followup.json](../docs/performance/flight-followup.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/production-home-six-improvements.json](../docs/performance/production-home-six-improvements.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/resource-visual-check.json](../docs/performance/resource-visual-check.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/startup-deep-review.json](../docs/performance/startup-deep-review.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/startup-review-followup.json](../docs/performance/startup-review-followup.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [docs/performance/startup-six-improvements.json](../docs/performance/startup-six-improvements.json) | Report scope / data structure | Parsed measurement/report structure; renderer, resolution/build scope and claims cross-checked. |
| [frontend/.gitignore](../frontend/.gitignore) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/.nvmrc](../frontend/.nvmrc) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/EXPERIENCE.md](../frontend/EXPERIENCE.md) | Documentation / contract consistency | Historical experience passes labelled; current contracts and review linked. |
| [frontend/README.md](../frontend/README.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [frontend/REVIEW.md](../frontend/REVIEW.md) | Documentation / contract consistency | Historical review labelled; superseded renderer/count claims retained as history. |
| `frontend/e2e/console.spec.ts` → [split feature suites](../frontend/e2e/) | Test contracts / execution | Public-control browser journeys, declared state fixtures, isolation and failure artifacts. |
| `frontend/e2e/improvements.spec.ts` → [split feature suites](../frontend/e2e/) | Test contracts / execution | R6/R8/R14 browser regressions; backup/history/visibility/accessibility and public console flows. |
| [frontend/e2e/serve_backend.py](../frontend/e2e/serve_backend.py) | Source / process lifecycle | Ephemeral database, child shutdown and owned-process cleanup. |
| [frontend/eslint.config.js](../frontend/eslint.config.js) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/index.html](../frontend/index.html) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/package-lock.json](../frontend/package-lock.json) | Lock/export consistency | Resolved structure, manifest/runtime-export parity and offline lock validity; no fresh advisory-feed claim. |
| [frontend/package.json](../frontend/package.json) | Source | Scripts/runtime constraints and all dependency declarations match the lock. |
| [frontend/playwright.config.ts](../frontend/playwright.config.ts) | Source | One browser worker, isolated loopback servers/database, software GPU and artifact retention. |
| [frontend/public/arcade-nexus.png](../frontend/public/arcade-nexus.png) | Asset structure / resources | Bundled resource structure, integrity/dimensions or embedded/external references; used in browser journeys. |
| [frontend/public/games/asteroids.svg](../frontend/public/games/asteroids.svg) | Asset structure / resources | Bundled resource structure, integrity/dimensions or embedded/external references; used in browser journeys. |
| [frontend/public/games/breakout.svg](../frontend/public/games/breakout.svg) | Asset structure / resources | Bundled resource structure, integrity/dimensions or embedded/external references; used in browser journeys. |
| [frontend/public/games/merge-2048.svg](../frontend/public/games/merge-2048.svg) | Asset structure / resources | Bundled resource structure, integrity/dimensions or embedded/external references; used in browser journeys. |
| [frontend/public/games/prism-rush.svg](../frontend/public/games/prism-rush.svg) | Asset structure / resources | Bundled resource structure, integrity/dimensions or embedded/external references; used in browser journeys. |
| [frontend/public/games/raptor.svg](../frontend/public/games/raptor.svg) | Asset structure / resources | Bundled resource structure, integrity/dimensions or embedded/external references; used in browser journeys. |
| [frontend/public/games/snake.svg](../frontend/public/games/snake.svg) | Asset structure / resources | Bundled resource structure, integrity/dimensions or embedded/external references; used in browser journeys. |
| [frontend/public/games/stellar-flight.svg](../frontend/public/games/stellar-flight.svg) | Asset structure / resources | Bundled resource structure, integrity/dimensions or embedded/external references; used in browser journeys. |
| [frontend/public/games/tetris.svg](../frontend/public/games/tetris.svg) | Asset structure / resources | Bundled resource structure, integrity/dimensions or embedded/external references; used in browser journeys. |
| [frontend/public/models/Jet.glb](../frontend/public/models/Jet.glb) | Asset structure / resources | Bundled resource structure, integrity/dimensions or embedded/external references; used in browser journeys. |
| [frontend/public/textures/grid.png](../frontend/public/textures/grid.png) | Asset structure / resources | Bundled resource structure, integrity/dimensions or embedded/external references; used in browser journeys. |
| [frontend/scripts/benchmark-games.mjs](../frontend/scripts/benchmark-games.mjs) | Source | Declared scenes, sample/reset/frame scope, hardware identity, reentry/resource sampling, cleanup. |
| [frontend/scripts/measure-startup.mjs](../frontend/scripts/measure-startup.mjs) | Source | Entry plus all eager module preloads; independent gzip scope and output. |
| [frontend/src/App.css](../frontend/src/App.css) | Stylesheet structure / browser checks | Parsed rules; visibility/focus, reduced motion, layout constraints, expensive effects and browser rendering. |
| [frontend/src/App.tsx](../frontend/src/App.tsx) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/src/__tests__/App.test.tsx](../frontend/src/__tests__/App.test.tsx) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/api.test.ts](../frontend/src/__tests__/api.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/audioManager.test.ts](../frontend/src/__tests__/audioManager.test.ts) | Test contracts / execution | R9: unavailable devices/nodes, mute/zero volume, idle/resume, overlapping cues; isolated/shuffled. |
| [frontend/src/__tests__/background.test.ts](../frontend/src/__tests__/background.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/backup.test.ts](../frontend/src/__tests__/backup.test.ts) | Test contracts / execution | R6: quota plus stale storage; live preference export and existing browser restore contracts. |
| [frontend/src/__tests__/controls.test.ts](../frontend/src/__tests__/controls.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/engine.test.ts](../frontend/src/__tests__/engine.test.ts) | Test contracts / execution | R11: terminal flag on loss, false on pause/error, cleared on undo; RAF/input lifecycle. |
| [frontend/src/__tests__/errorBoundary.test.tsx](../frontend/src/__tests__/errorBoundary.test.tsx) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/flightAudio.test.ts](../frontend/src/__tests__/flightAudio.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/flightHUD.test.ts](../frontend/src/__tests__/flightHUD.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/gameSession.test.tsx](../frontend/src/__tests__/gameSession.test.tsx) | Test contracts / execution | R10: delayed initial records cannot overwrite a new completion receipt. |
| [frontend/src/__tests__/gamepadPower.test.ts](../frontend/src/__tests__/gamepadPower.test.ts) | Test contracts / execution | R7: primary device replacement and held inputs; idle/visibility/reconnect. |
| [frontend/src/__tests__/games.test.ts](../frontend/src/__tests__/games.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/graphicsQuality.test.ts](../frontend/src/__tests__/graphicsQuality.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/improvements.test.ts](../frontend/src/__tests__/improvements.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/menuNavigation.test.ts](../frontend/src/__tests__/menuNavigation.test.ts) | Test contracts / execution | R8: native layout boxes do not make hidden/closed/disabled/inert controls focusable. |
| [frontend/src/__tests__/modalFocus.test.tsx](../frontend/src/__tests__/modalFocus.test.tsx) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/newGames.test.ts](../frontend/src/__tests__/newGames.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/performance.test.ts](../frontend/src/__tests__/performance.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/progressPage.test.tsx](../frontend/src/__tests__/progressPage.test.tsx) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/recovery.test.ts](../frontend/src/__tests__/recovery.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/renderResources.test.ts](../frontend/src/__tests__/renderResources.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/saveCompatibility.test.ts](../frontend/src/__tests__/saveCompatibility.test.ts) | Test contracts / execution | R13: real Raptor init/restore from historical config; preserve valid/current custom tuning. |
| [frontend/src/__tests__/sessionQueue.test.ts](../frontend/src/__tests__/sessionQueue.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/setup.ts](../frontend/src/__tests__/setup.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| `frontend/src/__tests__/spaceJourney.test.ts` → [Node simulation suite](../frontend/src/__tests__/spaceJourney.node.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/__tests__/stores.test.ts](../frontend/src/__tests__/stores.test.ts) | Test contracts / execution | Behavior contracts, assertions, setup/cleanup and mocking boundaries; executed by Vitest. |
| [frontend/src/api/client.ts](../frontend/src/api/client.ts) | Source | One URL convention, profile headers, typed contracts, timeouts, cancellation and error translation. |
| [frontend/src/components/AutomaticBackups.tsx](../frontend/src/components/AutomaticBackups.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/Background.tsx](../frontend/src/components/Background.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/Confirmation.tsx](../frontend/src/components/Confirmation.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/ConsoleUI.tsx](../frontend/src/components/ConsoleUI.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/ControllerKeyboard.tsx](../frontend/src/components/ControllerKeyboard.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/ErrorBoundary.tsx](../frontend/src/components/ErrorBoundary.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/FlightBriefing.tsx](../frontend/src/components/FlightBriefing.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/GameCanvas.tsx](../frontend/src/components/GameCanvas.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/Layout.tsx](../frontend/src/components/Layout.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/LoadingSpinner.tsx](../frontend/src/components/LoadingSpinner.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/SessionHistoryModal.tsx](../frontend/src/components/SessionHistoryModal.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/Toast.tsx](../frontend/src/components/Toast.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/arcus/BootSequence.tsx](../frontend/src/components/arcus/BootSequence.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/arcus/GameCard.tsx](../frontend/src/components/arcus/GameCard.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/arcus/GameCarousel.tsx](../frontend/src/components/arcus/GameCarousel.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/arcus/ProfileSelector.tsx](../frontend/src/components/arcus/ProfileSelector.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/arcus/ProfileSetup.tsx](../frontend/src/components/arcus/ProfileSetup.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/components/arcus/SystemMenu.tsx](../frontend/src/components/arcus/SystemMenu.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/console.css](../frontend/src/console.css) | Stylesheet structure / browser checks | Parsed rules; visibility/focus, reduced motion, layout constraints, expensive effects and browser rendering. |
| [frontend/src/games/asteroids/Asteroids.ts](../frontend/src/games/asteroids/Asteroids.ts) | Source | Wrapping, splitting, waves, respawn/lives, saved RNG and drawing; R12 open score/count bounds. |
| [frontend/src/games/breakout/Breakout.ts](../frontend/src/games/breakout/Breakout.ts) | Source | Swept/substep collisions, campaign/Arcade sectors, armor/explosions, pickups/lives, cache/state. |
| [frontend/src/games/breakout/sectors.ts](../frontend/src/games/breakout/sectors.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/descriptors.ts](../frontend/src/games/descriptors.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/experience.ts](../frontend/src/games/experience.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/feedback.ts](../frontend/src/games/feedback.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/index.ts](../frontend/src/games/index.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/merge-2048/Merge2048.ts](../frontend/src/games/merge-2048/Merge2048.ts) | Source | Merge-once, spawn/undo RNG, daily puzzles, semantic reader; R12 open tile continuation ceiling. |
| [frontend/src/games/merge-2048/puzzle.css](../frontend/src/games/merge-2048/puzzle.css) | Stylesheet structure / browser checks | Parsed rules; visibility/focus, reduced motion, layout constraints, expensive effects and browser rendering. |
| [frontend/src/games/merge-2048/puzzles.ts](../frontend/src/games/merge-2048/puzzles.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/prism-rush/PrismRun.ts](../frontend/src/games/prism-rush/PrismRun.ts) | Source | Rhythms, input edges, reaction windows, lane collisions, saves; R12 open score bound. |
| [frontend/src/games/prism-rush/PrismRush.ts](../frontend/src/games/prism-rush/PrismRush.ts) | Source | WebGL resize/HUD, pooled corridor geometry, instance bounds and shared disposal. |
| [frontend/src/games/prism-rush/prism.css](../frontend/src/games/prism-rush/prism.css) | Stylesheet structure / browser checks | Parsed rules; visibility/focus, reduced motion, layout constraints, expensive effects and browser rendering. |
| [frontend/src/games/raptor-run/RaptorRun.ts](../frontend/src/games/raptor-run/RaptorRun.ts) | Source | Jump/duck/buffer, phrase feasibility, near misses, difficulty/physics, state/RNG and art. |
| [frontend/src/games/raptor-run/index.ts](../frontend/src/games/raptor-run/index.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/raptor-run/phrases.ts](../frontend/src/games/raptor-run/phrases.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/records.ts](../frontend/src/games/records.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/snake/Snake.ts](../frontend/src/games/snake/Snake.ts) | Source | Tail/full-board rules, turn queue, mazes/sprints/bonuses, state/RNG and Full HD cache. |
| [frontend/src/games/snake/index.ts](../frontend/src/games/snake/index.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/snake/mazes.ts](../frontend/src/games/snake/mazes.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/stellar-flight/AsteroidField.ts](../frontend/src/games/stellar-flight/AsteroidField.ts) | Source | Conservative sphere culling, change detection, pending upload ranges and shared resources. |
| [frontend/src/games/stellar-flight/FlightAudio.ts](../frontend/src/games/stellar-flight/FlightAudio.ts) | Source | Mute/pause/resume fades, async context transitions, deduplicated automation and teardown. |
| [frontend/src/games/stellar-flight/FlightController.ts](../frontend/src/games/stellar-flight/FlightController.ts) | Source | Analog throttle, clamping, pitch/roll/yaw and banking conventions. |
| [frontend/src/games/stellar-flight/FlightHUD.ts](../frontend/src/games/stellar-flight/FlightHUD.ts) | Source | Projection/radar/direction conventions, layout-before-write ordering, cached DOM and cleanup. |
| [frontend/src/games/stellar-flight/SpaceJourney.ts](../frontend/src/games/stellar-flight/SpaceJourney.ts) | Source | Gates/misses, boost/shield/collisions, routes/contracts/surveys, ships, long simulation and migrations. |
| [frontend/src/games/stellar-flight/StellarFlight.ts](../frontend/src/games/stellar-flight/StellarFlight.ts) | Source | WebGL init/resize/async GLB cancellation, floating origin, instancing/streaming and disposal. |
| [frontend/src/games/stellar-flight/contracts.ts](../frontend/src/games/stellar-flight/contracts.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/stellar-flight/course.ts](../frontend/src/games/stellar-flight/course.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/stellar-flight/flight.css](../frontend/src/games/stellar-flight/flight.css) | Stylesheet structure / browser checks | Parsed rules; visibility/focus, reduced motion, layout constraints, expensive effects and browser rendering. |
| [frontend/src/games/stellar-flight/routes.ts](../frontend/src/games/stellar-flight/routes.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/stellar-flight/ships.ts](../frontend/src/games/stellar-flight/ships.ts) | Source | Game-specific data/helpers, deterministic rules or geometry, save compatibility and resource ownership. |
| [frontend/src/games/stellar-flight/universe.ts](../frontend/src/games/stellar-flight/universe.ts) | Source | Seeded sectors, safe launch/beacons, bounded neighborhood reuse and swept body collision. |
| [frontend/src/games/tetris/Tetris.ts](../frontend/src/games/tetris/Tetris.ts) | Source | Bag, hold, rotations/kicks, locking, sprint timing, RNG and drawing; R12 open score bound. |
| [frontend/src/hooks/useConfirmation.tsx](../frontend/src/hooks/useConfirmation.tsx) | Source | Effect ownership, stale callbacks/cancellation, event cleanup and UI callers. |
| [frontend/src/hooks/useGameSession.ts](../frontend/src/hooks/useGameSession.ts) | Source | R10 fixed: stale record reads; lifecycle/async saves/clocks. R12 remains open at extreme limits. |
| [frontend/src/hooks/useGamepad.ts](../frontend/src/hooks/useGamepad.ts) | Source | Effect ownership, stale callbacks/cancellation, event cleanup and UI callers. |
| [frontend/src/hooks/useLocalConnection.ts](../frontend/src/hooks/useLocalConnection.ts) | Source | Effect ownership, stale callbacks/cancellation, event cleanup and UI callers. |
| [frontend/src/hooks/useModalFocus.ts](../frontend/src/hooks/useModalFocus.ts) | Source | R8 shared focus rules; nested/native ownership and focus restoration. |
| [frontend/src/hooks/useToast.ts](../frontend/src/hooks/useToast.ts) | Source | Effect ownership, stale callbacks/cancellation, event cleanup and UI callers. |
| [frontend/src/index.css](../frontend/src/index.css) | Stylesheet structure / browser checks | R14 fixed: reduced motion finishes infinite loops; global focus/style and responsive rules. |
| [frontend/src/main.tsx](../frontend/src/main.tsx) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/src/pages/Achievements.tsx](../frontend/src/pages/Achievements.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/pages/Dashboard.tsx](../frontend/src/pages/Dashboard.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/pages/GamePlayer.tsx](../frontend/src/pages/GamePlayer.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/pages/Library.tsx](../frontend/src/pages/Library.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/pages/Profile.tsx](../frontend/src/pages/Profile.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/pages/Progress.tsx](../frontend/src/pages/Progress.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/pages/Settings.tsx](../frontend/src/pages/Settings.tsx) | Source | R6 fixed: persistence feedback; retries, controls, data/backup flows. |
| [frontend/src/pages/Store.tsx](../frontend/src/pages/Store.tsx) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/pages/index.ts](../frontend/src/pages/index.ts) | Source | Rendering/async states, controls/actions, error feedback, focus/accessibility and lifecycle callers. |
| [frontend/src/sdk/AudioManager.ts](../frontend/src/sdk/AudioManager.ts) | Source | R9 fixed: device failures, overlapping cues, monotonic idle suspension, mute/resume. |
| [frontend/src/sdk/CanvasLayer.ts](../frontend/src/sdk/CanvasLayer.ts) | Source | Game/input/render contract, lifetime, state/resource constraints and integration. |
| [frontend/src/sdk/GameEngine.ts](../frontend/src/sdk/GameEngine.ts) | Source | R11 fixed: terminal result distinct from pause/error; fixed-step/render cap, input, teardown. |
| [frontend/src/sdk/GameSDK.ts](../frontend/src/sdk/GameSDK.ts) | Source | R11 additive ended metric; 2D/3D interfaces, input/state/resource contracts. |
| [frontend/src/sdk/GamepadManager.ts](../frontend/src/sdk/GamepadManager.ts) | Source | R7 fixed: primary-controller handover, held buttons; visibility/idle polling. |
| [frontend/src/sdk/GraphicsQuality.ts](../frontend/src/sdk/GraphicsQuality.ts) | Source | Game/input/render contract, lifetime, state/resource constraints and integration. |
| [frontend/src/sdk/InputManager.ts](../frontend/src/sdk/InputManager.ts) | Source | Game/input/render contract, lifetime, state/resource constraints and integration. |
| [frontend/src/sdk/README.md](../frontend/src/sdk/README.md) | Documentation / contract consistency | Commands, contracts, links, stated evidence and outstanding acceptance cross-checked. |
| [frontend/src/sdk/Random.ts](../frontend/src/sdk/Random.ts) | Source | Game/input/render contract, lifetime, state/resource constraints and integration. |
| [frontend/src/sdk/index.ts](../frontend/src/sdk/index.ts) | Source | Game/input/render contract, lifetime, state/resource constraints and integration. |
| [frontend/src/sdk/menuNavigation.ts](../frontend/src/sdk/menuNavigation.ts) | Source | R8 fixed: shared focus visibility and reachable disclosure summaries. |
| [frontend/src/services/background.ts](../frontend/src/services/background.ts) | Source | Visible-only timers, cancellation, event wakeups and non-overlapping work. |
| [frontend/src/services/backup.ts](../frontend/src/services/backup.ts) | Source | R6 fixed: export live preferences; browser validation and remapping. |
| [frontend/src/services/connection.ts](../frontend/src/services/connection.ts) | Source | Shared loopback health, visibility, subscribers and offline-browser behavior. |
| [frontend/src/services/controls.ts](../frontend/src/services/controls.ts) | Source | Default aliases, reserved keys, custom conflicts and stored-binding normalization. |
| [frontend/src/services/download.ts](../frontend/src/services/download.ts) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/src/services/lifecycle.ts](../frontend/src/services/lifecycle.ts) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/src/services/performance.ts](../frontend/src/services/performance.ts) | Source | Bounded validated history, frame summaries, corrupt data and storage handling. |
| [frontend/src/services/recovery.ts](../frontend/src/services/recovery.ts) | Source | Per-owner serialized/coalesced writes, ordered guarded deletes, volatile storage fallback. |
| [frontend/src/services/saves.ts](../frontend/src/services/saves.ts) | Source | R13 fixed: historical Raptor config; envelope validation and other rule migrations. |
| [frontend/src/services/sessionQueue.ts](../frontend/src/services/sessionQueue.ts) | Source | R11 ended flag persists; retries/locks/storage/replay. R12 numeric boundary was open at this snapshot; subsequently resolved. |
| [frontend/src/stores/libraryStore.ts](../frontend/src/stores/libraryStore.ts) | Source | Request/mutation ordering, stale state, persistence/error paths and callers. |
| [frontend/src/stores/profileStore.ts](../frontend/src/stores/profileStore.ts) | Source | Tab identity, mutation/list/stat revisions, failed-refresh behavior and activation races. |
| [frontend/src/stores/settingsStore.ts](../frontend/src/stores/settingsStore.ts) | Source | R6 fixed: volatile preferences, safe persistence and status notification; hydration/bindings. |
| [frontend/src/utils/formatting.ts](../frontend/src/utils/formatting.ts) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/tailwind.config.js](../frontend/tailwind.config.js) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/tsconfig.app.json](../frontend/tsconfig.app.json) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/tsconfig.json](../frontend/tsconfig.json) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/tsconfig.node.json](../frontend/tsconfig.node.json) | Source | Source/configuration read; runtime defaults, callers/paths and compatibility cross-checked. |
| [frontend/vite.config.ts](../frontend/vite.config.ts) | Source | Loopback dev/preview proxy, host/origin behavior, CSS/test integration. |
| [scripts/check.py](../scripts/check.py) | Source | Explicit sequential local lint/unit/types/build/browser checks; failure propagation. |
| [scripts/laptop_check.py](../scripts/laptop_check.py) | Source | Isolated visible/native diagnostic, CLI bounds, hardware/power labels, Vite lifecycle. |

## Implementation follow-up

This ledger preserves the reviewed 261-path snapshot. The subsequent [implementation report](REVIEW_FOLLOWUP.md) covers the new contract, service, session-feature, codec, simulation/renderer, style and diagnostic modules, plus the R16 renderer-retention fix and real browser collection regressions. [Current source measurements](review-completion-metrics.json) and [validation](VALIDATION.md) describe that changed tree; the original review does not imply source inspection of future revisions.
