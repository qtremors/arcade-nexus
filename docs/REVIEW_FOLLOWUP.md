# Review implementation and closure

Current implementation on `ag-dev`, based on `183ae27`. The functional, architecture and file-ledger reviews retain their original snapshots. This document is the current item-by-item status; [VALIDATION.md](VALIDATION.md) records verification.

## Functional findings — R1–R15

All fifteen original reproduced software findings are addressed. The completion pass also found and fixed R16, described below. R1–R11 and R13–R15 retain their trigger, fix and regression evidence in [DEEP_REVIEW.md](DEEP_REVIEW.md). R12 now has explicit game/save/result boundaries rather than an open continuation-policy decision.

`contracts/gameplay-limits.json` owns the completion bounds shared by Pydantic and the browser. Frontend metrics are inferred from one Zod contract. Unsupported saved scores are rejected before active-engine replacement; the six 2D simulations and Prism report unsupported score arithmetic visibly. Flight retains its existing bounded score/metric policy. Raptor jump/progress and Asteroids wave arithmetic also check their next counters before exceeding the supported range, retaining a recordable result and valid recovery state. Invalid completion payloads never enter the retry queue.

2048 explicitly finishes at **1,048,576**, with a “Maximum tile reached” result. A restored ceiling board cannot merge beyond it; Classic undo remains available. Catalog rules version **4** keeps older records separate, and the launch guide explains the final tile.

All eight games use lazy pure codecs for restore preflight. The engine validates outgoing snapshots through the same parser, preventing an invalid snapshot from replacing previous recovery. Common envelope types and schema live in `contracts/saves.ts`; codecs import pure catalog metadata without pulling in the lazy factory registry.

## Additional finding — R16, renderer retention

The longer resource pass found detached 3D canvases remaining reachable after game/engine objects were collected. Plain canvas/WebGL controls collected correctly; forcing context loss did not remove the retaining path. Three r186's shared `DFG_LUT` texture kept per-renderer disposal listeners alive, and Flight's shared sprite geometry also retained its renderer listener.

`SharedLightingResources` captures that uniform through the public material shader hook, preserves shader code/cache identity, and releases its texture before renderer teardown. Flight also disposes sprite geometry. No private renderer fields, dependency-source patches or context-loss workaround are used; the same canvas remains reusable for restart.

The [original ten-entry probe](performance/renderer-lifetime-before.json) retained ten detached canvases in each game. [Repeating it after the fix](performance/renderer-lifetime-after.json) retained **zero games, engines and canvases** in both; [control results](performance/renderer-lifetime-controls.json) distinguish it from plain canvas/WebGL collection. Permanent browser checks exercise real Three.js/GC reachability and zero post-disposal geometry/texture counters; a unit check guards shader/cache identity and delayed uniform population. Native GPU/process/power acceptance remains H1.

## Architecture findings — A1–A8

| Item | Completed change | Evidence |
| --- | --- | --- |
| A1 — Session ownership | One coordinator owns run identity and named commands. Engine initialization/disposal, cancellation generations and browser lifecycle have a runtime owner; completion caching/delivery has its own owner. Clock, checkpoints, records, slots and menu routing remain focused modules. Panels receive read-only display data and commands. Late callbacks and receipts cannot alter a replacement run. | Coordinator 647 → 349 lines; canvas view 437 → 127. Deferred-load, failed-init, old-engine and late-receipt regressions complement browser pause/restart/quit/restore/undo/profile/exit coverage. |
| A2 — Backend ownership | Portable schemas, backup transfer, atomic completion, shared session predicates and legacy start/playtime/score transactions live outside routers. Scheduler calls services directly; route handlers adapt HTTP input/errors. Application and CLI composition roots own engines/factories. | Nine-query exports, transactional rollback, UUID/reservation mappings, immutable/concurrent receipts and legacy semantics remain tested. No service imports routers. |
| A3 — Contracts | All JSON success responses have explicit OpenAPI schemas, including category/unlock/root/health and snapshot-file content. Offline generation owns 59 frontend schema types. API transport, generated-derived domain types and domain adapters are separate; nullable game configuration is normalized explicitly. Queue metadata remains separate from HTTP payloads. | 45 operations: 42 nonempty JSON success schemas, zero empty; three intentional 204 responses. Backend coverage and generated-file parity enforce the contract. |
| A4 — Saves | Common identity/version framing is separate from game-specific compatibility. All eight codecs reuse state validators without allocating a renderer. Historical migrations stay with their games; pure catalog metadata removes the registry dependency. | Historical full-save tests, rejected-save session preservation and Node restoration checks. No local import cycles, including lazy/type imports. |
| A5 — Game responsibilities | Snake, Raptor, Breakout, 2048, Tetris and Asteroids each separate DOM-free simulation from browser rendering/effects. 2048's semantic board reader is a separate adapter. Prism keeps its established split. Flight separates steering/energy, collision encounters, route planning, gate/race progression and objective/reward policies; `SpaceJourney` coordinates their original update order and owns its save. | Saved-future Node tests across all 13 modes of the five newly split games; existing Raptor, Prism and twenty-minute Flight tests. A [temporary baseline comparison](review-completion-parity.json) matched 900 updates and sampled canvas commands in all 13 modes, plus three 3,600-step seeded Flight trajectories. Flight aggregate 889 → 474 lines; update is 25 lines. |
| A6 — SDK direction | Input preferences, measurement persistence, game effects and shared audio use typed ports wired by the application. SDK modules do not import application stores/services. Result queue and shared audio retain application lifetime. | Ownership checks, input/controller lifecycle, audio transition and engine/resource tests. |
| A7 — Style ownership | Theme tokens and shared session menus have single owners. Catalog/settings/dialog/history styles belong to features; game-specific HUD/briefing styles stay lazy. Import order is explicit. | Desktop/narrow-layout accessibility, focus, reduced-motion and Full HD buffer checks. Palette/graphics settings remain unchanged in this completion pass. |
| A8 — Tests and diagnostics | Feature browser suites share typed fixtures and isolated household cleanup, retaining one worker. Node simulations run separately from JSDOM components/adapters. Benchmarks use public input/frame/resource ports. | Full browser suite, DOM-free tests, all-module AST ownership/import-cycle checks and the declared rendering/resource diagnostic. |

The secondary cleanup recommendations are also implemented: API transport/domain/type ownership, history query/filter state separated from dialog presentation, and factory-owned database resources. No general ECS, cross-game inheritance framework or CI/CD was introduced.

## Verification and scope

Run `python scripts/check.py --browser` for generated-contract parity, backend/frontend ownership checks, import-cycle analysis, Ruff, pytest, ESLint, Vitest, TypeScript, production build and isolated real-server browser journeys. The final run passed 121 backend tests, 225 frontend tests and all 48 browser cases. Long all-mode diagnostics, focused post-fix checks and exact scopes are in [VALIDATION.md](VALIDATION.md).

[Current measurements](review-completion-metrics.json) and [the import report](review-completion-imports.json) describe this tree. Earlier metrics remain historical. File sizes describe ownership, not a complexity or performance score.

## Acceptance that cannot run in this cloud workspace

Software implementation is complete for R1–R16 and A1–A8. Physical/human acceptance remains open: named native integrated/dedicated GPUs, power/thermals/input latency, wired/Bluetooth controllers and target OS/browser combinations, assistive-technology users, and unfamiliar-player clarity/balance/replay. [PLAYTEST.md](PLAYTEST.md) records the evidence required for each. Software-rendered diagnostics do not close those items.

Installer packaging, mobile/multiplayer, additional content, and a new art/audio direction remain product decisions outside these review fixes.
