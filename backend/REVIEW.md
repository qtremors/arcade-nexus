# Backend review and patch record

Branch: ag-dev. Starting commit: 95312de. Scope: every original source, model, schema, router, configuration, dependency, and test file under backend. The frontend was read only to preserve its request/response expectations.

This pass keeps FastAPI and the browser architecture. It does not rewrite the project in Rust or package an executable.

## File-by-file results

| File | Review result and patch |
| --- | --- |
| app/__init__.py | Package marker inspected; no behavior needed changing. |
| app/config.py | Removed unused signing-key generation; modern settings configuration; stable OS data paths; legacy database preference; validated local runtime settings; anchored .env and relative URLs. |
| app/database.py | Correct file/in-memory pooling; foreign keys, WAL and busy timeout; request-scoped sessions with rollback; explicit transactional upgrades; legacy adoption checks; SQLite backups before migration. |
| app/datetime_utils.py | Retained UTC clock and added an ORM type that restores timezone information on SQLite reads. |
| app/main.py | Added independently configurable application factory, database readiness check, engine disposal, structured logging, bounded requests, trusted hosts/origins, and safe validation/conflict/lock responses. |
| app/seed.py | Syncs copies rather than mutating module definitions; serializes catalog changes; persists score conditions; preserves retired-game data and existing achievement IDs; closes CLI resources. |
| app/models/__init__.py | Checked registration of every relationship target; standardized imports and exports. |
| app/models/user.py | UTC dates and a partial unique index ensure at most one active selected profile; soft deletion semantics preserved. |
| app/models/game.py | Kept the persisted enum names compatible; migrated to StrEnum; UTC dates; checked cascades against the actual soft-retirement workflow. |
| app/models/library.py | Existing membership uniqueness retained; UTC dates. |
| app/models/save.py | Slot check constraint added; existing profile/game/slot uniqueness retained; UTC dates. |
| app/models/stats.py | Nonnegative database constraints; UTC dates; existing profile/game uniqueness retained. |
| app/models/session.py | Durable nullable UUID identity with uniqueness; nullable end time for unfinished sessions; history index; nonnegative duration/score; UTC dates. |
| app/models/achievement.py | Existing definition/unlock uniqueness retained; UTC dates; condition validation implemented in the router. |
| app/schemas/__init__.py | Updated public exports to include new typed session and achievement responses. |
| app/schemas/user.py | Trimmed nonempty usernames; rejected control/surrogate characters; bounded avatars; supported explicit avatar clearing. |
| app/schemas/game.py | Bounded metadata; structured finite JSON configuration; exposed configuration in game responses. |
| app/schemas/library.py | Replaced deprecated ORM configuration while preserving response shape. |
| app/schemas/save.py | Shared one JSON validator; measured UTF-8 bytes; rejected NaN/Infinity; typed JSON; strict slot bounds. |
| app/schemas/stats.py | Bounded strict integer scores/durations; difficulty enum; optional UUID identities; typed start, completion, score and history responses. |
| app/schemas/achievement.py | Bounded slug inputs and modern response configuration. |
| app/routers/__init__.py | Checked router registration; standardized imports. |
| app/routers/profiles.py | Serialized profile writes; preserved duplicate-name behavior; fixed null avatar clearing; deterministic replacement selection; safe soft deletion. |
| app/routers/games.py | Fixed literal LIKE escaping with an explicit escape character; stable pagination; creation disabled by default; race-safe duplicate handling. |
| app/routers/library.py | Atomic unique membership insertion; recent-played ordering; optional pagination; inactive catalog filtering; removal preserves progress. |
| app/routers/saves.py | Atomic slot upsert; preserve creation time and ID; partial metadata updates; path validation; explicit profile scoping; access to historical retired-game saves. |
| app/routers/stats.py | Atomic maximum-score updates; durable starts; opt-in idempotent starts/completions; profile/game ownership checks; typed filtered/paginated history; one consistent aggregate snapshot; preserved the frontend's new-high-score sequence. |
| app/routers/achievements.py | Qualifies score unlocks from recorded data; unique idempotent insertion; excludes inactive games; correctly counts scoped unlocks; optional pagination. |
| app/utils/__init__.py | Exports explicit profile lookup/dependency; removed implicit default-user creation. |
| app/utils/local_user.py | Optional X-Profile-ID with no fallback for invalid IDs; 409 if no selected profile; no reads that silently create/resurrect players. |
| run.py | Loopback default; reload opt-in; settings-based port/logging; explicit CLI entry point. |
| .env.example | Replaced misleading secret-key instructions with actual local configuration. |
| pyproject.toml | Fixed readme/version; canonical bounded dependencies; current dependency groups; lint/format, pytest, and thread/greenlet coverage configuration; explicit SQLAlchemy asyncio extra. |
| uv.lock | Updated and verified resolved runtime and development dependencies. |
| requirements.txt | Regenerated from the canonical lock rather than retaining an incompatible older stack. |
| tests/test_api.py | Replaced global clients with isolated lifecycle fixtures; startup, schema readiness, host/origin/body protections, restart persistence, explicit-profile errors, OpenAPI checks. |
| tests/test_stats.py | Legacy behavior, strict validation, concurrent scores, session ownership, replay/conflict behavior, history ordering and pagination. |

Added infrastructure:

- app/dependencies.py: shared endpoint dependency annotations.
- app/services/common.py: active/historical game lookup and atomic statistics creation.
- app/schemas/base.py: shared request/response and JSON validation rules.
- app/middleware.py: checks browser mutation origins and bounds whole request bodies.
- app/migrate.py: standalone upgrade command with connection cleanup.
- alembic.ini, migrations/env.py, migrations/script.py.mako, migrations/versions/: stable historical baseline and transactional schema revisions.
- tests/conftest.py and tests/test_profiles.py, test_saves.py, test_catalog.py, test_achievements.py, test_database.py, test_config.py: temporary databases and targeted regressions.
- README.md: runtime, upgrade/backup, API integration and compatibility documentation.

## Compatibility and boundaries

Existing frontend endpoints and response fields remain. New response fields are additive. Timestamps now consistently include UTC timezone information.

Intentional changes: requesting player data without a selected profile returns 409; game metadata creation requires ALLOW_GAME_CREATION; invalid/oversized data returns validation errors; achievement score thresholds are enforced; inactive games are hidden from current library/achievement lists. Historical progress is preserved.

The browser integration is not complete merely because the backend accepts profile/session identities. The frontend still needs to send X-Profile-ID and reuse session UUIDs before cross-tab isolation and retry deduplication are guaranteed.

The frontend follow-up implements full simulation saves, validated versioned game state, actual jump and flight measurements, automatic pause, and result submission recovery. Browser launching, bundled frontend serving, executable packaging, and scheduled backups remain follow-up work. Existing ORM hard-delete cascades remain: the application retires games and soft-deletes profiles; a future permanent-delete feature must define its data retention explicitly.

Known legacy schema adoption covers the checked-in v1.4.1 layout. Earlier schemas missing columns and corrupt rows require deliberate repair. Manual downgrades remove UUID session identities; restore a backup to retain the complete newer representation.

Validation was performed in the Linux workspace with Python 3.12. Platform-specific executable packaging and Windows/macOS runtime behavior are not claimed as tested.

## Final validation

- 86 backend regression tests pass with 96% application statement coverage.
- Ruff lint and format checks pass; dependency lock validation and git diff whitespace checks pass.
- A real Uvicorn process was launched on loopback from a different working directory. Readiness, browser-origin requests, profile creation, save writes, duplicate session completion, and graceful shutdown passed.
- The standalone migration command passed against a temporary database.
- The revised frontend production build passes with separately loaded games and bundled fonts. Three.js is a large optional chunk; see frontend/REVIEW.md for browser validation.

## Second backend pass and frontend integration

Rechecked profiles, sessions, saves, achievement qualification, migrations and request guards. Added revision 0003 for bounded session metrics, exposed achievement conditions, and replaced the first-jump score proxy with actual jump counts. Altitude and safe-flight awards now qualify from completed session measurements. Seed sync adds Breakout and Merge 2048 without deleting previous progress. Additional tests cover event qualification, safe-flight duration and immutable metric replay. Browser integration tests use a temporary database and real HTTP requests; profile IDs and session UUIDs are now sent by the frontend.
