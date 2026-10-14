# Full HD game performance

The current target is **1080p, medium-or-better graphics, 60 FPS**, including integrated-graphics laptops. The games never silently lower resolution or remove visible scene detail under load. Rendering is capped at 60 FPS to avoid unnecessary work on high-refresh laptop displays. Native hardware acceptance remains pending.

The latest combined regression results are in [VALIDATION.md](VALIDATION.md). The subsequent backup, storage and keyboard review is in [RELIABILITY.md](RELIABILITY.md).

“Medium+” is a visual acceptance requirement, not a standardized GPU preset across these custom games. The implementation retains all current lighting, scene objects, effects and 3D antialiasing. Confirm visual quality and sustained performance together on named hardware.

## Rendering policy

- All eight games use a Full HD backing buffer, fitted within 1920 × 1080 while preserving aspect ratio. A 16:9 playfield uses 1920 × 1080; the original 3:2 games use 1620 × 1080. Window size and display DPR do not trigger a lower performance tier. There is no adaptive resolution reduction.
- The six 2D games keep their 960 × 640 logical coordinates and rules. After initialization, the engine enlarges the physical canvas and applies a drawing transform. Shapes and text render at the higher resolution; glow radii scale with the buffer. This is not an upscale of a finished low-resolution image. Saves, collisions and difficulty remain unchanged.
- A one-time graphics probe selects CPU canvas rasterization for known software GPUs, where Chromium's software GPU canvas path is expensive. Real GPUs retain browser acceleration. Both paths use the same Full HD dimensions and artwork, with the low-latency canvas hint enabled. Headless Chromium can omit a desynchronized CPU canvas from composed screenshots; drawing-buffer captures are used to inspect its artwork without slowing the production renderer.
- Both 3D games request the browser's low-power GPU preference, allowing laptops to use integrated graphics without explicitly waking a dedicated GPU. This is a browser hint, not a guarantee of adapter selection. Antialiasing, lighting, materials, geometry and effects remain enabled.
- Prism batches repeated barriers, crystals, road markings and arches. Flight retains all neighboring-sector asteroids in its simulation and caches their transforms. A single instanced batch submits only asteroid bounding spheres that intersect the camera frustum; objects crossing the screen edge remain included, and turning or moving restores newly visible rocks. This reduces vertex processing without changing hazards or visible detail.
- Snake caches its background/grid/walls, and Breakout caches its background and glowing bricks, at the full physical canvas resolution. Changes to walls, bricks, armor, stages, saves or buffer dimensions invalidate the cache. Each active game retains one extra Full HD canvas (about 6.7 MiB of RGBA pixels at 1620 × 1080), released on exit. Dynamic effects and text still draw normally. Tetris shares precomputed rotation matrices instead of allocating them during collision and ghost checks.
- `requestAnimationFrame` schedules at most 60 rendered frames per second; simulation stays fixed at 60 Hz with bounded catch-up. Tests cover 60/75/120/144/165/240 Hz displays and 30 Hz catch-up. Pause cancels the pending callback and resume schedules one fresh loop, excluding paused time from gameplay and FPS measurements. High-refresh displays whose rate is not divisible by 60 necessarily have uneven presentation intervals.
- Settings → Local performance measurements shows average FPS, p50/p95 frame interval, buffer dimensions and graphics profile after exiting a game. Export JSON to compare devices. Measurements are local and bounded to the last ten sessions, with at most 3,600 frame samples per session.

## Repeatable engine benchmark

For the requested 12th-generation Intel i7 without a dedicated GPU, the one-command native workflow is `python scripts/laptop_check.py --power ac` from the repository root after setup. It opens visible Chrome, runs at Full HD/full detail for 60 seconds per case, adds late-run 3D fixtures and measures ten entry/exit cycles. Use `--browser msedge` for Edge, `--browser chromium`/`CHROMIUM_PATH` for Chromium, `--all-modes` for every bundled mode and repeat with `--power battery`. See [SIX_IMPROVEMENTS.md](SIX_IMPROVEMENTS.md) for report interpretation and the distinction between reported hardware and acceptance.

From `frontend`, start a Vite development server:

```sh
npm run dev -- --port 5175 --strictPort
```

In another terminal, run the eight-game diagnostic without other builds/tests competing for CPU:

```sh
SOFTWARE_GPU=1 npm run benchmark:games
```

This writes `performance-results.json`. `BENCH_URL`, `BENCH_OUTPUT`, `BENCH_GAMES` (comma-separated slugs), and `CHROMIUM_PATH` are configurable. Omit `SOFTWARE_GPU=1` and use `HEADFUL=1` for a visible browser on real hardware; confirm the reported WebGL renderer and browser GPU diagnostics. A headed run still needs a declared display refresh rate and normal power/thermal settings.

Additional diagnostics: `BENCH_MODES=all` selects every catalog mode, `BENCH_STRESS=1` adds declared 3D late-run scenarios, and `BENCH_REENTRY_CYCLES=10` records post-GC heap and post-disposal renderer counters. `BENCH_LABEL`, `BENCH_POWER` and `BROWSER_CHANNEL` record target/power and select installed Chrome/Edge channels. The report records actual CPU, OS, available parallelism, browser, selected renderer/display and antialiasing; target labels do not establish hardware identity. Nonzero renderer-internal counters after disposal alone do not prove a leak.

The default script uses a 1280 × 800 browser, DPR 1, a 960 × 640 CSS canvas with a 1620 × 1080 backing buffer, seed 123, normal difficulty and the first mode of each game. It warms up for three seconds, samples fifteen seconds of scripted play and reports resets/errors. It also reports render submission time, draw calls, submitted triangles and live renderer geometry/texture counts. Submission time includes JavaScript and driver work, not completed GPU execution or total process CPU/power consumption.

Use `BENCH_WIDE=1` for a 1920 × 1080 viewport and a true 1920 × 1080 buffer in both 3D games; the 3:2 games retain their 1620 × 1080 playfields. `BENCH_WARMUP_SECONDS` and `BENCH_SAMPLE_SECONDS` override the durations. For a longer laptop diagnostic:

```sh
HEADFUL=1 BENCH_WIDE=1 BENCH_WARMUP_SECONDS=5 BENCH_SAMPLE_SECONDS=60 npm run benchmark:games
```

The script exercises the SDK plus game, without the React console. It is a comparative diagnostic, not an all-mode, late-wave, thermal or input-latency acceptance test. Initialization and initial shader compilation are outside the sample window. Frame-interval storage remains bounded to the most recent 3,600 renders.

For acceptance, use the full console and the matrix in [PLAYTEST.md](PLAYTEST.md): each game/mode, late-game stress, pause/resume, repeated entry and sustained 60-second samples on named integrated and dedicated GPUs. Record AC/battery state, power mode, thermals, browser, driver, display refresh rate and actual selected adapter. Measure CPU/GPU utilization and power with platform tools; FPS alone does not establish lower resource use.

## Cloud diagnostic results

The earlier adaptive-resolution experiment has been superseded by the user's quality requirement. Its approximately 51–53 FPS Prism / 39 FPS Flight results used 320 × 213 buffers and must not be presented as 1080p results.

Measured 2026-10-13 with Chromium 151.0.7922.173, an AMD EPYC 7763 host, a two-CPU container quota, 8 GiB RAM and ANGLE/SwiftShader software WebGL. The workspace has no native GPU device. Each game used a 1620 × 1080 buffer, matching its 3:2 aspect ratio; both 3D games kept antialiasing and full scene detail. No builds or tests competed with the measured pass.

| Game | Average FPS | p95 frame interval | Buffer |
| --- | ---: | ---: | --- |
| Neon Snake | 60.0 | 16.7 ms | 1620 × 1080 |
| Raptor Run | 60.0 | 16.7 ms | 1620 × 1080 |
| Neon Breakout | 59.9 | 16.8 ms | 1620 × 1080 |
| Merge 2048 | 60.0 | 16.7 ms | 1620 × 1080 |
| Neon Tetris | 60.0 | 16.8 ms | 1620 × 1080 |
| Asteroids | 60.0 | 16.7 ms | 1620 × 1080 |
| Prism Rush | 12.5 | 100.1 ms | 1620 × 1080 |
| Stellar Flight | 9.0 | 216.7 ms | 1620 × 1080 |

The six 2D games reached approximately 60 FPS, with no sampled frames over 33.4 ms. The two 3D games **did not meet the 60 FPS target on this software renderer**. They retained quality rather than reducing resolution. These numbers cannot establish native integrated/dedicated GPU performance, either positively or negatively.

No runtime/page errors occurred. Asteroids restarted once after scripted play exhausted its lives; the other games had no restarts. This remains a short, first-mode diagnostic, not an all-mode or late-game stress result. Raw data: [Full HD measurement](performance/cloud-full-hd.json). The [original baseline](performance/cloud-before.json) and [superseded adaptive experiment](performance/cloud-adaptive-experiment.json) used different resolutions and are not equivalent-quality comparisons.

## Resource optimization verification (2026-10-14)

The six-item follow-up also ran 60-second, 1920 × 1080 software-rendered 3D samples, including declared late-run fixtures, on the same two-CPU cloud environment. Antialiasing remained enabled. These are engine diagnostics rather than Intel laptop measurements:

| Game/scenario | Average FPS | p95 frame interval |
| --- | ---: | ---: |
| Prism, normal | 13.1 | 116.7 ms |
| Prism, late run | 12.4 | 100.1 ms |
| Flight, normal | 8.9 | 183.4 ms |
| Flight, late run | 10.9 | 183.3 ms |

All four cases completed without runtime/page errors, followed by ten entry/exit cycles each. Post-GC JavaScript heap grew approximately 0.69–0.94 MiB from the first to tenth cycle; post-disposal renderer counters stayed constant. These short trends do not establish a leak-free session or a retained-object diagnosis. Raw data: [60-second follow-up](performance/cloud-six-improvements.json).

A capture experiment disabled the desynchronized hint for software 2D canvases. It restored composed screenshots but reduced measured FPS to approximately 20–22. That change was reverted; the production renderer retains the faster path. The [compositor experiment](performance/cloud-six-2d-compositor-experiment.json) is retained as diagnostic evidence, separate from the [final 2D follow-up](performance/cloud-six-2d.json). Direct canvas image capture verifies painting, not native display presentation.

The final isolated 2D follow-up sampled ten seconds after a five-second warm-up per game. All six games averaged 59.9–60.0 FPS at 1620 × 1080, with p95 intervals of 16.7 ms, no sampled frames over 33.4 ms and no runtime/page errors. These short engine samples preserve the earlier result; they are not the required sustained native-laptop acceptance.

The 60 FPS limit, paused-loop suspension, canvas caching and asteroid culling preserve the Full HD quality policy above. Identical seeded initial frames were captured against `09eaf2f`, with fonts explicitly loaded and decorative randomness fixed. Seven games were pixel-identical; Snake's dynamic glow compositing differed by less than 0.02 per channel on a 0–255 scale averaged over the image. Flight submitted 13,786 triangles instead of 36,426 in the initial view (62% fewer), with the same 33 draw calls and identical pixels. Eight additional Flight orientations across two neighborhoods also retained identical pixels. These are selected-frame comparisons, not every possible camera/state. Raw comparisons: [resource visual check](performance/resource-visual-check.json).

A fresh diagnostic on 2026-10-14 used Chromium 151.0.7922.173, an AMD EPYC 9V74 host, a two-CPU container quota, 8 GiB RAM and ANGLE/SwiftShader. Builds and tests had finished before sampling. The six 2D games averaged 59.9–60.0 FPS at 1620 × 1080, with p95 intervals of 16.7–16.8 ms. The 3D games retained their full detail:

| Game | FPS at 1620 × 1080 | p95 | FPS at 1920 × 1080 | p95 |
| --- | ---: | ---: | ---: | ---: |
| prism-rush | 15.3 | 100.0 ms | 13.2 | 116.7 ms |
| stellar-flight | 12.0 | 166.8 ms | 9.2 | 216.6 ms |

Both 3D games still fall below the 60 FPS target on this software renderer. The same-size pre-change diagnostic measured 15.0 FPS for Prism and 11.1 FPS for Flight; these short passes do not establish a sustained FPS gain, real GPU performance, or power savings. All ten optimized game/size runs completed without runtime/page errors. The verified work reductions are the 60 FPS cap, cancellation of paused callbacks, cached rasterization and fewer submitted asteroid triangles. Native integrated-GPU acceptance remains open.

Raw data: [same-size pre-change diagnostic](performance/cloud-resource-before.json), [all eight optimized games](performance/cloud-resource-optimized.json), [1920 × 1080 3D diagnostic](performance/cloud-resource-wide.json).

The full local validation command `python scripts/check.py --browser` passed: 99 backend tests, 137 frontend unit tests, all 27 browser scenarios, Ruff, ESLint, TypeScript and the production build. New checks cover high-refresh frame limiting, pause callback cancellation, bounded catch-up, conservative culling at view edges/turns/floating origins, and Full HD cache invalidation/release.

## Further Flight resource reductions

- Asteroid matrices/colors now upload only when the visible instance slots change; unchanged views also skip the frustum scan. Moving the floating origin without changing the visible set needs no new instance data. Restored or streamed asteroid data explicitly invalidates the cache, and pending upload ranges survive multiple updates before a draw.
- `SectorStream` reuses overlapping procedural descriptions while retaining only 27 sectors. Moving one sector along one axis creates nine descriptions instead of regenerating all 27. Route generation uses its own short-lived stream to reuse overlapping neighborhoods; seed changes discard cached descriptions. Generated geometry, hazards, RNG trajectories and saves remain unchanged.
- Engine audio avoids identical frequency/gain automation events. Pause, mute and zero volume suspend the private audio context after a 500 ms fade allowance. Rapid resume cancels pending suspension or waits for an in-flight transition before restarting. Teardown cancels timers and cannot revive a closed context.
- The Flight HUD reads canvas layout before DOM writes, caches instrument element references, and avoids unchanged meter/target/result text writes.

A real Chromium probe submitted 60 frames with tiny lateral movement and the same 42 visible asteroids at 1920 × 1080 with antialiasing. Simulating the previous unconditional-upload policy produced 60 matrix and 60 color uploads; the optimized path produced zero, with identical final canvas pixels. Browser audio moved from running to suspended on pause/mute and returned to running on resume. Eight additional seeded Flight camera/position comparisons against the preceding optimization pass were pixel-identical. These verify selected behavior and reduced API work, not native GPU frame rate or power draw. Raw results: [Flight follow-up probe](performance/flight-followup.json).

The full local check script passed with 99 backend tests, 142 frontend unit tests, Ruff, ESLint, TypeScript and a production build. All seven targeted Flight/Full HD browser scenarios also passed, covering ship selection, races, surveys, migration, contracts, saves and all-game buffer/antialiasing checks. Follow-up unit coverage includes overlapping-sector reuse and seed invalidation, unchanged asteroid buffers under camera movement and save invalidation, audio transition races/automation deduplication, and HUD layout ordering. Real integrated-GPU profiling remains the highest-value next step for the 3D scenes.

## Earlier verification and outstanding acceptance

- 129 frontend unit tests passed. The five graphics tests additionally verify Full HD scaling, unchanged logical game dimensions, hardware/software canvas selection, frame metrics and fixed-rate simulation under 120 Hz render scheduling.
- Seven targeted browser scenarios passed after the Full HD change, covering all eight games, save/restore and a dedicated all-game buffer/3D-antialiasing assertion. The earlier 26-scenario full browser suite passed before this final graphics-profile change.
- ESLint, the production build and whitespace checks pass. Existing large-bundle warnings remain. Full HD screenshots of Flight and Prism were inspected.
- Outstanding: sustained 1080p/60 FPS and visual acceptance on named integrated and dedicated GPUs, using the complete console and late-game loads. No minimum GPU specification is established by this cloud run.
