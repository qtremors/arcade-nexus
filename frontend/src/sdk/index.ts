/**
 * SDK exports
 */
export type {
  GameConfig,
  InputState,
  GameInstance,
  LegacyGameInstance,
  Game2DInstance,
  Game3DInstance,
  GameFactory,
  GameType,
} from "./GameSDK";
export {
  registerGame,
  getGame,
  hasGame,
  listGames,
  is2DGame,
  is3DGame,
} from "./GameSDK";
export { InputManager } from "./InputManager";
export { GameEngine } from "./GameEngine";
