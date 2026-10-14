# Full HD game performance

The current requirement is **1080p, medium-or-better graphics, at least 60 FPS**, for integrated-graphics laptops and dedicated-GPU PCs. Quality takes priority over frame rate: the games never silently lower resolution or remove scene detail under load. Native hardware acceptance remains pending. 120 FPS is a stretch target on capable GPUs and high-refresh displays.

“Medium+” is a visual acceptance requirement, not a standardized GPU preset across these custom games. The implementation retains all current lighting, scene objects, effects and 3D antialiasing. Confirm visual quality and sustained performance together on named hardware.

## Rendering policy

- All eight games use a Full HD backing buffer, fitted within 1920 × 1080 while preserving aspect ratio. A 16:9 playfield uses 1920 × 1080; the original 3:2 games use 1620 × 1080. Window size and display DPR do not trigger a lower performance tier. There is no adaptive resolution reduction.
- The six 2D games keep their 960 × 640 logical coordinates and rules. After initialization, the engine enlarges the physical canvas and applies a drawing transform. Shapes and text render at the higher resolution; glow radii scale with the buffer. This is not an upscale of a finished low-resolution image. Saves, collisions and difficulty remain unchanged.
- A one-time graphics probe selects CPU canvas rasterization for known software GPUs, where Chromium's software GPU canvas path is expensive. Real GPUs retain browser acceleration. Both paths use the same Full HD dimensions and artwork.
- Both 3D games keep antialiasing enabled and every scene object present. Prism batches repeated barriers, crystals, road markings and arches. Flight batches neighboring-sector asteroids and updates static transforms only when the neighborhood or race changes. These optimizations do not alter physical hazards, lighting or material detail.
- Rendering follows `requestAnimationFrame`. The deterministic simulation remains fixed at 60 Hz; rendering faster does not accelerate timers, movement, collisions or scoring. A mocked 120 Hz scheduling test checks this separation; it does not establish physical 120 FPS output or interpolated 120 Hz movement.
- Settings → Local performance measurements shows average FPS, p50/p95 frame interval, buffer dimensions and graphics profile after exiting a game. Export JSON to compare devices. Measurements are local and bounded to the last ten sessions, with at most 3,600 frame samples per session.

## Repeatable engine benchmark

From `frontend`, start a Vite development server:

```sh
npm run dev -- --port 5175 --strictPort
```

In another terminal, run the eight-game diagnostic without other builds/tests competing for CPU:

```sh
SOFTWARE_GPU=1 npm run benchmark:games
```

This writes `performance-results.json`. `BENCH_URL`, `BENCH_OUTPUT`, `BENCH_GAMES` (comma-separated slugs), and `CHROMIUM_PATH` are configurable. Omit `SOFTWARE_GPU=1` and use `HEADFUL=1` for a visible browser on real hardware; confirm the reported WebGL renderer and browser GPU diagnostics. A headed run still needs a declared display refresh rate and normal power/thermal settings.

The script uses a 1280 × 800 browser, DPR 1, a 960 × 640 CSS canvas with a 1620 × 1080 backing buffer, seed 123, normal difficulty and the first mode of each game. It warms up for three seconds, samples fifteen seconds of scripted play and reports resets/errors. It exercises the SDK plus game, without the React console. It is a short comparative diagnostic, not an all-mode, late-wave, thermal or input-latency acceptance test. Game initialization and shader compilation are outside the sample window.

For acceptance, use the full console and the matrix in [PLAYTEST.md](PLAYTEST.md): each game/mode, late-game stress, pause/resume, repeated entry and sustained 60-second samples on both declared hardware classes. A 60 Hz headless display cannot establish physical 120 FPS output.

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

## Verification and outstanding acceptance

- 129 frontend unit tests passed. The five graphics tests additionally verify Full HD scaling, unchanged logical game dimensions, hardware/software canvas selection, frame metrics and fixed-rate simulation under 120 Hz render scheduling.
- Seven targeted browser scenarios passed after the Full HD change, covering all eight games, save/restore and a dedicated all-game buffer/3D-antialiasing assertion. The earlier 26-scenario full browser suite passed before this final graphics-profile change.
- ESLint, the production build and whitespace checks pass. Existing large-bundle warnings remain. Full HD screenshots of Flight and Prism were inspected.
- Outstanding: sustained 1080p/60 FPS and visual acceptance on named integrated and dedicated GPUs, using the complete console and late-game loads. No minimum GPU specification or physical 120 FPS claim is established by this cloud run.
