# Console experience standard

Arcade Nexus is a local browser console. The quality target covers the whole journey: choosing a player, browsing, launching, learning controls, playing, pausing, saving and returning. Reliability checks establish whether behavior works; they do not establish whether a game is enjoyable or finished.

## Quality pass — 2026-10-10

| Area                | Implemented improvement                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch and pause    | Consistent typography, spacing and panels; live game preview behind the menu; primary action receives focus; current paused score; fullscreen control; short control instructions.                                                     |
| Results             | Game-specific outcomes and details; a separate personal-best badge so winning a game is not hidden by a generic score headline.                                                                                                        |
| Destructive actions | Console confirmation dialogs for library, player and save removal; cancellation first; native modal focus/inert behavior; keyboard Escape and controller B cancel.                                                                     |
| Controllers         | Spatial focus on console pages, shoulder navigation between main sections, volume-slider and checkbox interaction, Start pauses the game, launch/Resume confirmation does not bleed into gameplay.                                     |
| Snake               | Two-turn queue preserved in saves, collection sound and readable point feedback, pace indicator, optional animation respects preferences.                                                                                              |
| Raptor              | Recognizable curved dinosaur silhouette, animated legs and claws, layered mesa landscape and passing foliage, clearer HUD, deliberate jump presses with a short landing buffer, later introduction of birds, minimum obstacle spacing. |
| Breakout            | Three distinct sectors with increasing ball speed, paddle aiming, clear lives and remaining-block HUD, ball trail and brick fragments, impact/collection/life-loss sound, sector and outcome persistence.                              |
| 2048                | Tile slides, merge/spawn animation, deliberate value palette, score/highest-tile/goal hierarchy, one-move undo with keyboard or controller, saved undo state.                                                                          |
| Flight              | Banked turns, visible gate challenge, swept gate detection, progress and next-gate distance, rolling terrain with matching collision heights, ground-clearance warning, improved aircraft lighting, course persistence.                |

Sound is synthesized locally and follows volume/mute preferences. Optional effects follow reduced-animation settings. New state fields have defaults so existing full saves remain readable; incomplete historical score-only saves still cannot reconstruct a run.

## Release bar and further work

A console release needs sustained human playtesting, a settled art direction, tuned difficulty and replay goals, stronger audio composition, and measured frame pacing on supported hardware. Authored sprite/animation assets and richer flight environments can raise the visual ceiling further. Controller-only text entry needs an on-screen keyboard. Physical controller testing, native GPU testing and platform/browser certification remain open.

Review future changes against these concrete criteria:

- Every visible action works, gives feedback, and can recover from a local-server error.
- Essential information is readable during motion and is not covered by navigation chrome.
- Controls feel intentional; held confirmation or pause input cannot trigger an unwanted action.
- Difficulty changes are meaningful, hazards are readable, and failure gives the player useful feedback.
- Save/load restores the actual run, including new mechanics, without moving progress between players.
- Effects support the action, respect preferences, and preserve responsive controls.
- Content adds depth and replay value; the number of games alone is not a quality measure.

Validation for this pass: 52 frontend unit tests and eleven real-server browser journeys pass, including full-save compatibility, undo, course progress, controller input isolation, menu focus and cancellation. Lint, formatting, TypeScript checks and the production build pass. The backend catalog's eight tests also pass after updating game descriptions. The previous complete backend review passed 86 tests with 96% application coverage.

This pass improves the games and console substantially. It does not certify the final release against that entire bar.

## PC OLED visual pass — 2026-10-10

The console now uses a true-black background, near-black surfaces, restrained game accents and consistent borders. A featured panel and a compact five-game shelf replace the blurred cover carousel. Navigation is labelled, cover illustrations share an art style, and catalog cards keep a stable size when a search returns one game.

Store and Library search locally after one catalog load, provide clear no-result states and recover from loading errors. Library sorting, achievement filters and earned dates make collections and progress easier to scan. Profiles, onboarding, settings, the system menu, history, confirmations and launch/pause menus follow the same OLED direction. The boot screen uses a brief, quiet reveal and respects reduced-motion preferences. Launch guides show keyboard and controller bindings; no touch controls were added.

Validation: 52 unit tests pass. All thirteen real-server Chromium journeys have passed, including two new journeys for the shelf, category/search states, recovery, control guides and desktop window sizing. The menu journey also checks keyboard access to the pause guide. ESLint, Prettier, TypeScript and the production build pass. Screens were visually inspected at 1440 × 900 and checked for horizontal overflow at desktop window widths down to 800 pixels. The existing optional Flight chunk still produces Vite's large-chunk warning.

This is the visual-first PC pass. Gameplay simulation, scoring and save formats retain their existing behavior; further game tuning remains part of the wider experience work.
