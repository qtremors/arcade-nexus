# Validation of the local-console iteration

Validated on `ag-dev`, 2026-10-12, Linux, Python 3.12, Node 24 and Chromium. No CI/CD configuration was created.

- 95 backend tests passed, including migration, atomic/concurrent result replay, backup rollback/copies, restored queue replay and production deep links.
- 62 frontend unit tests passed, including real game save/restore trajectories, buffered input, catch-up ticks, terminal undo and brick mechanics.
- 18 browser journeys passed in one clean run, including Continue, backup download/import, mode completion medals, controller text entry/disconnect, profile isolation, saves, retry and narrow windows.
- Ruff, ESLint, TypeScript, production build and whitespace checks passed. Vite still reports a chunk-size advisory for the main and lazy Flight bundles; this is not a measured performance regression.
- Production launcher smoke test: installed dependencies used with `UV_OFFLINE=true`; restart preserved the isolated demonstration profile; an occupied port returned exit code 1; SIGTERM shut down successfully and released the server port.
- Abrupt browser process SIGKILL: the latest automatic snapshot restored exactly in a fresh browser through server recovery.
- Production screenshots captured with non-loopback browser requests blocked: no page errors and no external requests.

Tests and screenshots used isolated data, not the user's existing database. Screenshots are in `/workspace/scratch/arcade-nexus-screenshots` for this workspace session.

Physical controller compatibility, native GPU/input-latency measurements and an observed human playtest remain manual acceptance work; follow PLAYTEST.md. Headless software rendering does not establish game balance or target-hardware performance.
