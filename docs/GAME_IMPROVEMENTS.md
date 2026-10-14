# Gameplay improvements on ag-dev

Implemented on `ag-dev`: the eight-game catalog now includes the improvements below. Automated checks cover rules, deterministic saves, puzzle solutions, obstacle feasibility, and browser flows. Human balance and native hardware acceptance remain open; these checks do not establish enjoyment or input comfort.

## Implemented

| Game | Shipped change |
| --- | --- |
| Neon Snake | Four connected maze layouts with a safe starting corridor. Separate 60-second Bonus Sprint offers optional +30 gold packets with a 4.5-second expiry. |
| Raptor Run | Complete authored obstacle phrases, jump-aware spacing, close-hitbox near-miss feedback, and four distance-based biomes. |
| Neon Breakout | Separate six-sector Arcade mode, 12-second wide paddle and 10-second multiball pickups, power-up timers, and visible final-brick assistance. Classic and daily campaigns retain three sectors and their records. |
| Merge 2048 | Undo restores RNG state, including legacy one-move saves. Six authored daily puzzles have move limits and no random spawns. Optional semantic board, slide/undo buttons, and live merge explanations. |
| Stellar Flight | Four named race patterns, three survey landmark silhouettes, H/left-stick-click contract selection with a fresh baseline, and distinct acceleration, boost, recharge, shield, and handling tradeoffs. |
| Neon Tetris | Completed 40-line sprints rank by elapsed simulation time. Results, launch screen, and Progress show milliseconds; earlier score records retain their meaning. |
| Asteroids | Stronger small-fragment outlines and fill contrast, plus a live remaining-rock count alongside wave feedback. |
| Prism Rush | Four complete six-gate lane rhythms retain the minimum reaction window and restore the exact next beat. |

Shared result screens compare against the previous personal best. Records remain partitioned by mode, daily date, difficulty, and rules. The offline result queue now accepts long-flight and multi-wave measurements up to the backend's existing bounds. Sprint times survive retries and backup copies without a database migration.

Current gameplay rules: Snake 3, Raptor 3, Breakout 2, 2048 3, Flight 5, Tetris 2, Asteroids 1, Prism 2. Older saves gain defaults and continue under current rules; historical records are preserved. Breakout's new Arcade mode is a separate partition under its unchanged rules version.

## Original review and remaining acceptance

The table records the problems that motivated this work and the remaining human acceptance criteria.

### Existing five review

| Game | Current opportunity | Next useful change | Acceptance |
| --- | --- | --- | --- |
| Neon Snake | Garden maze always builds the same two vertical walls. Sprint uses the regular food loop. | Add a small set of authored, reachable maze layouts; add optional timed bonus packets in sprint with a clear risk/reward choice. | Every layout has a safe start and reachable food. Compare first-minute failures and voluntary replays. |
| Raptor Run | Obstacle generation selects a sequence anew for each obstacle; “CLEAN DODGE” counts any jump/duck when an obstacle passes. | Generate complete obstacle phrases, validate jump/duck recovery windows at maximum speed, and reserve near-miss rewards for genuinely close passes. Add biome changes at distance milestones. | A deterministic input trace can traverse each phrase at every difficulty; no impossible bird/landing combinations. |
| Neon Breakout | Campaign has three fixed layouts. It already has armor, explosions, and last-brick aim assistance. | Expand to authored sectors with distinct routes; add clearly timed wide-paddle and multiball pickups in a separate arcade mode. Explain the existing final-brick assist visually. | Measure sector length, life loss, and last-brick cleanup. Preserve the existing campaign records. |
| Merge 2048 | Existing modes differ mainly in undo availability. Undo restores the board/score but does not restore the random generator state. | Decide and document whether undo should replay the same spawn; add fixed-board, move-limited puzzle challenges and an optional explanation of merges. | Daily puzzles are solvable; undo and save/restore follow the documented random-sequence contract. |
| Stellar Flight | Contracts cycle through five counter targets; ships largely vary in speed/handling. | Author distinctive race routes and survey landmarks, offer a choice of contracts, and give ships clear handling/boost tradeoffs. Keep the forgiving endless journey. | New players can identify the next objective; compare race completion, route variety, and time to meaningful unlocks. |

## Across the collection

1. **Fairness and clarity first:** observe a new player for ten minutes per game. Record first failure, misunderstood controls, and whether they choose another round. Tune reaction windows before adding harder obstacles.
2. **Meaningful mastery:** show a compact personal-best comparison and game-specific result details. Preserve mode/difficulty/rules partitions when adding mechanics that change scoring.
3. **Variety without clutter:** build small authored level/pattern libraries. Make new mechanics optional modes where they would alter familiar rules.
4. **Performance and controls:** measure real 60/120/144 Hz hardware, physical controllers, repeated game entry/exit, and small desktop windows. Automated browser tests use software WebGL and cannot establish hardware frame pacing.
5. **Accessibility:** keep objective/control guides concise, distinguish hazards by shape as well as color, and validate reduced motion. 2048 is the best starting point for a semantic, screen-reader-playable board.

## New additions and follow-ups

- **Neon Tetris:** marathon and sprint, seven-piece bags, hold, next three previews, ghost landing, soft/hard drops, repeat movement, wall/floor kicks, lock delay, and saved random state. Time-ranked records are implemented through the catalog contract. Physical-controller repeat tuning remains open.
- **Asteroids:** inertia, thrust/braking, wrapping collisions, split fragments, escalating waves, three hulls, and temporary respawn shields. Next: playtest small-fragment readability and wave lengths before adding new enemy types.
- **Prism Rush:** pooled 3D gates, three discrete lanes with smooth movement, a clear opening per gate, crystals, braking, rising speed, and three shields. Authored rhythms are implemented. Speed perception and gate spacing still need native GPU playtests.

Full HD buffers, preserved antialiasing/scene detail, batched 3D rendering and a repeatable eight-game benchmark are implemented. See [PERFORMANCE.md](PERFORMANCE.md) for measured results and the outstanding 1080p/60 FPS hardware acceptance.

Next: playtest all eight with unfamiliar players and physical controllers, measure native frame pacing, then tune using the observations.
