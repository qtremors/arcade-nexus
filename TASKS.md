# Verified follow-up work

The current iteration implements the local launcher, Continue/recovery, portable backup copies, simpler navigation, atomic completion, per-mode records, daily challenges, game progression, controller text entry/remapping and local regression checks. See DEVELOPMENT.md for the shipped contracts.

Remaining acceptance work requires real people or hardware:

- Run docs/PLAYTEST.md with an unfamiliar player; use observed confusion and voluntary replay to tune the eight games.
- Validate sustained 60 FPS at 1080p with medium-or-better graphics on named integrated and dedicated GPUs, with the 60 FPS render limit enabled; measure p95 frame pacing, CPU/GPU use, power, input latency and repeated-entry memory. The software-renderer benchmark in docs/PERFORMANCE.md is diagnostic evidence, not hardware acceptance.
- Validate physical controllers (wired/Bluetooth), OS/browser combinations and controller-only onboarding.
- Review color contrast and nonvisual puzzle access with assistive technology users. Canvas labels do not provide full nonvisual gameplay.

Future product decisions, not implementation prerequisites: a packaged desktop installer, additional browsers/mobile layouts, more games, multiplayer, and external content distribution.

No CI/CD is planned or configured for this work.

The gameplay implementation and remaining human acceptance criteria are in [docs/GAME_IMPROVEMENTS.md](docs/GAME_IMPROVEMENTS.md). Neon Tetris, Asteroids, and Prism Rush are now bundled; include their new acceptance cases in the next physical-controller and human playtest pass.

Implemented follow-through: connected Snake mazes/Bonus Sprint, Raptor phrases/biomes, six-sector Breakout Arcade/pickups, deterministic 2048 undo/daily puzzles/text board, Flight routes/landmarks/contracts/ship tradeoffs, Tetris sprint timing, Asteroids readability, Prism rhythms, and personal-best deltas.

The broader reliability review also shipped bounded backup queries, export of memory-only results/recovery, validated browser restore with consistent session remapping, cross-tab result reconciliation, corrupt performance-history handling, and modal keyboard focus improvements. Evidence and remaining limits are in [docs/RELIABILITY.md](docs/RELIABILITY.md).

The six-item follow-up implements visibility/queue-aware background work, Web Locks for retries, lazy routes and backup modules, server-wide history sorting and filters, rotating server snapshots, restore previews, root crash recovery and binding conflict checks. Automated controller lifecycle and desktop/zoom accessibility checks are included. The native test command targets the user's 12th-generation Intel i7 with integrated graphics; actual-device FPS/power and physical-controller/human acceptance remain pending. See [docs/SIX_IMPROVEMENTS.md](docs/SIX_IMPROVEMENTS.md).

The next review coalesces slow recovery writes, guards profile changes against stale responses, removes unused profile reads, aggregates achievement counts and fixes loading/cancellation when switching record views. The regression evidence is in [docs/RELIABILITY.md](docs/RELIABILITY.md).

The maintained-file review fixes fourteen further backup/session, storage, launcher, controller, audio, compatibility and reduced-motion defects. Its [findings](docs/DEEP_REVIEW.md) and [file ledger](docs/REVIEW_FILES.md) preserve the evidence. Open follow-up R12: align game/save/result numeric limits, validate unsupported restored states before replacing an active run, and handle an invalid completion payload visibly; decide the 2048 continuation ceiling without silently changing comparable rules.

The [architecture review](docs/ARCHITECTURE_REVIEW.md) prioritizes typed response/metric contracts, backend backup/session services, a smaller session coordinator with named view commands, lazy pure save codecs, and selective simulation/renderer separation. Follow with feature-owned styles and shared test/diagnostic interfaces. The measured god-function hotspot is `useGameSession` (647 lines, 39 returned members); large art/data files have a lower priority. These structural changes are proposed work, with stage-specific completion checks in the review.
