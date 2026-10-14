# Agent-directed production browser review

Reviewed on 2026-10-14 using the production build, an isolated SQLite database/profile, Chromium 151, a 1920×1080 viewport and SwiftShader software rendering. Inputs were sent through the visible browser controls and keyboard. Screenshots were inspected, and games were paused between inspections. These were short functional/visual samples, not a human playtest, full campaigns or real-time game-feel/balance acceptance.

| Game | Inputs and observed result |
| --- | --- |
| Neon Snake | Started a run and turned with arrows. A wall collision produced the explicit “Watch the walls” result and replay controls. Direct drawing-buffer inspection shows the board, snake, packet and HUD; composed software-canvas capture has the limitation below. |
| Raptor Run | Jumped using Space; inspected the airborne character, biome, distance and Jump/Duck guide, then paused. |
| Neon Breakout | Launched using Space and moved the paddle right. The captured scene shows the moving ball/trail, shifted paddle, lives, sector and remaining-brick indicators. |
| Merge 2048 | Sent left/down/right/up moves. The board produced a 4 tile with score 4, with the board-reader entry point still available. |
| Neon Tetris | Rotated, moved left, hard-dropped and held a piece. The scene shows a landed piece, held piece, current/ghost piece, next previews and score 36. |
| Asteroids | Fired, thrust and turned. The scene shows bullets, the turned ship, rocks and respawn protection; pausing reported 20 points. |
| Prism Rush | Changed left/right lanes. The ship/road/HUD rendered, lane-change lean was visible, distance/points advanced and three shields remained. This short sample did not complete a gate sequence. |
| Stellar Flight | Switched ship and camera, steered and boosted. The HUD changed to Legacy Jet, speed rose, the ring distance decreased, and the full scene/HUD remained visible before pause. This sample did not complete a race. |

No page errors occurred during this review. Earlier automated journeys cover saves, recovery, undo, completion/medals, controller flows, races and historical migrations; the observations above do not replace those checks or the human/hardware checklist.

## Review findings

- Chromium's desynchronized CPU canvas contained the correct drawing-buffer pixels while composed screenshots showed black. A separate image/normal canvas displayed those same pixels correctly. Normal compositing restored captures, but an isolated benchmark dropped from approximately 60 FPS to 20–22 FPS, so that renderer change was reverted. The final code preserves the faster hint. A browser regression inspects Full HD dimensions, painted pixels and color detail and attaches the direct canvas image. Some inspected full-page 2D screenshots used the temporary compositor experiment; they are artwork inspection evidence, not final-path presentation proof. Native display presentation still requires the laptop check.
- Server logs showed periodic recovery writes continuing while paused. Five-second recovery scheduling now runs only during visible active play, while pause/exit still checkpoint immediately. A browser test observes the pause write, advances fifteen seconds without further writes, and confirms saves restart after resume.

The ephemeral screenshots/action log are in `/workspace/scratch/six-play-review` for this workspace session. The durable regression evidence is in the unit/browser tests and [VALIDATION.md](VALIDATION.md).

## Production startup check

The reviewed production Home navigation loaded 468,530 bytes of JavaScript, including its lazy page and dependencies. Settings/backup modules were absent. That review's final build had an eager entry/preload sum of 450,023 bytes; these are different scopes. Neither number measures launch latency. See [production Home assets](performance/production-home-six-improvements.json) and [entry/preload assets](performance/startup-six-improvements.json). Subsequent build sizes are recorded in [VALIDATION.md](VALIDATION.md).
