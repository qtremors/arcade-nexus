import type { GameInstance } from "../sdk/GameSDK";
export async function loadGame(slug: string): Promise<GameInstance> {
  switch (slug) {
    case "snake":
      return new (await import("./snake/Snake")).SnakeGame();
    case "raptor-run":
      return new (await import("./raptor-run/RaptorRun")).RaptorRunGame();
    case "stellar-flight":
      return new (
        await import("./stellar-flight/StellarFlight")
      ).StellarFlightGame();
    case "breakout":
      return new (await import("./breakout/Breakout")).BreakoutGame();
    case "merge-2048":
      return new (await import("./merge-2048/Merge2048")).Merge2048Game();
    default:
      throw new Error("This game is not bundled with Arcade Nexus");
  }
}
