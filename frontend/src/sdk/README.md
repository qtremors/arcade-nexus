# Arcade Nexus game SDK

Games implement `Game2DInstance` or `Game3DInstance` from `GameSDK.ts`. Canvas games receive a 2D context in `render`; WebGL games manage their renderer.

```ts
import type { Game2DInstance, GameConfig, InputState } from "./GameSDK";

export class Example implements Game2DInstance {
  readonly type = "2d" as const;
  private score = 0;

  init(canvas: HTMLCanvasElement, config: GameConfig): void {
    // Create simulation state using canvas.width/canvas.height.
  }

  update(milliseconds: number, input: InputState): boolean {
    // Advance simulation; return false exactly when the run ends.
    return true;
  }

  render(context: CanvasRenderingContext2D): void {
    // Draw without changing simulation state.
  }

  getScore(): number {
    return this.score;
  }
  destroy(): void {
    /* Release resources; tolerate repeated calls. */
  }
}
```

`GameEngine` updates at fixed 60 Hz using milliseconds and caps catch-up after a slow frame. Rendering follows the simulation; a game-over or frame exception stops the loop and notifies the UI. Input is released on pause/stop/blur. Keyboard taps are buffered until a simulation step consumes them. `input.keys` uses KeyboardEvent.code (`Digit1`, `KeyQ`, `ShiftLeft`), not character strings.

The console uses a 960×640 logical canvas scaled to the browser window. Resizing preserves the playfield and rules. A Three.js renderer should call `setSize(width, height, false)` so it does not override the canvas CSS size. `init` can be asynchronous; a game must handle being destroyed while assets load and release late-arriving assets. Dispose meshes, points, materials, textures and event listeners, including objects removed during map changes.

## Saves and achievements

`getResult()` may return `{ title, detail }` for the results screen. Use a concrete outcome such as a cleared course or a blocked board. Optional cosmetic feedback can use `games/feedback.ts`; it follows the console's mute/volume and reduced-animation preferences and is excluded from saved simulation state. New gameplay fields in an existing save version need validation and compatible defaults, or an explicit migration.

To support saving, implement both `getState()` and `setState(state)`. Snapshots must contain all gameplay state: positions, velocity, timers, board contents, score, difficulty, and relevant measurements. Return a copy, include a version, and validate the entire payload before changing live state. Throw an error for unsupported or corrupt data. Do not restore just the score. Cosmetic particles need not be persisted.

The console wraps game state as `{ format: 1, game: slug, difficulty, state }`. Loading validates a temporary game before replacing the current run; resuming a loaded game starts a new session. Save APIs and session APIs always use the player captured at game launch.

`getMetrics()` may return `{ jumps?, max_altitude?, crashed? }`. Backend bounds and validates those measurements on completion. Seeded achievement conditions may use `score`, `jumps`, `max_altitude`, or `flight_seconds` (completed active time with `crashed: false`). These are local player-controlled measurements, not competitive anti-cheat.

## Add a game

1. Create its implementation under `src/games/<slug>/`.
2. Add a dynamic import case in `src/games/index.ts`. Do not eagerly import Three.js into the console.
3. Add its metadata, config and achievement definitions in `backend/app/seed.py`. Startup synchronizes metadata while preserving player progress.
4. Add a local thumbnail in `frontend/public/games/` and control hints in `GameCanvas.tsx`.
5. Add meaningful rule/save tests and a browser journey with the real backend.

The older synchronous `registerGame`/`getGame` registry remains exported for compatibility; bundled games use the asynchronous loader.
