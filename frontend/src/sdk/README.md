# Game SDK

Implement `Game2DInstance` (Canvas) or `Game3DInstance` (WebGL), exported from `GameSDK.ts`. Supply `type`, `init(canvas, config)`, `update(milliseconds, input)`, and `render`; implement `destroy` for every resource/listener. Add an async loader to `games/descriptors.ts` and a matching definition to root `catalog.json`; seed display metadata/achievements in `backend/app/seed.py`. No synchronous registration API exists.

The engine supplies fixed 60 Hz updates and stable 960×640 logical dimensions. Browser resizing scales presentation without changing physics. `update` returns false to stop; `getStatus` can report `recoverable` and `recover` can undo a terminal move before a result is finalized. Final games report score, result copy, and bounded metrics. Keep simulation out of React.

The engine adds `metrics.ended` when `update` returns false; pause/ordinary quit/technical errors leave it false, and recovery clears it. Games use `completed` for objective completion and keep collision measurements separate. The server uses terminal status for atomic recovery cleanup while retaining legacy payload compatibility. Shared numeric bounds, pure codecs and the explicit 2048 ceiling address the extreme save/result boundary; see [the follow-up](../../../docs/REVIEW_FOLLOWUP.md).

Rendering is capped at 60 FPS independently of display refresh, with Full HD backing buffers and no adaptive quality reduction. Pausing cancels frame callbacks until resume. `CanvasLayer` can cache unchanged backgrounds at the target's physical resolution; invalidate when artwork changes and destroy the cache on exit. See [performance policy and benchmark](../../../docs/PERFORMANCE.md).

`InputState` includes held directions/action, ordered keyboard `pressed` codes consumed once per simulation step, raw keys, continuous dead-zone-adjusted axes, and analog trigger throttle. Menu confirm must be released before it becomes a game action. Do not repeat discrete actions merely because an update catches up several steps; Snake buffers turns, 2048 tracks directional edges, and Raptor buffers jumps.

For save support implement `getState` and `setState`, and register a lazy codec loader exporting `parseState` and `decodeSave` beside the game factory in `descriptors.ts`. Return an isolated JSON snapshot; validate the complete shape with Zod before changing live fields. Preserve rule-affecting random state using `Random`, and keep decorative `Math.random` separate. Save everything needed for the next simulation tick: progression, timers, queued actions, physics configuration, RNG state and undo state. Legacy state fields need explicit defaults or a migration; future/incomplete saves must fail clearly. The outer format-2 envelope is handled by `services/saves.ts` and the session hook.

Increment `rulesVersion` in the catalog whenever scoring/rules cease to be comparable. Records distinguish mode, difficulty, and version. Daily challenges seed from game slug and UTC date; restored saves retain their original challenge date. They are offline household challenges, not tamper-proof online rankings.

Game tests should exercise actual update/restore paths and deterministic futures. Browser tests should use public controls plus explicit saved edge-case boards, not production-only debug APIs. Use the [manual playtest](../../../docs/PLAYTEST.md) for balance and physical hardware acceptance.

The SDK accepts typed `RuntimePorts` instead of importing application state. `services/gameRuntime.ts` wires browser preferences, measurement storage and shared audio once at application lifetime. Expose benchmark input hints and rendering counters through the diagnostic ports; do not expose the engine or renderer’s private fields.


`SharedLightingResources` is a teardown workaround for Three r186's shared DFG lighting texture. Call `observe(scene)` after building the initial scene, before its first render; it captures the shared uniform through public material compilation hooks while preserving program cache keys and GLSL. Call `dispose()` before `renderer.dispose()`. Dispose shared sprite geometry as well as sprite materials/textures. No context loss is used, so restart can reuse its canvas. The browser resource suite guards collection and zero GPU counters; re-evaluate this workaround when upgrading Three.
