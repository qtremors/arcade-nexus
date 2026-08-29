import type { Game2DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { GameFeedback, simulationEffects } from "../feedback";
import { SnakeSimulation } from "./SnakeSimulation";
import { SnakeRenderer } from "./renderer";
import { useSettingsStore } from "../../shared/state/settingsStore";
export class SnakeGame implements Game2DInstance {
  readonly type = "2d" as const;
  private feedback = new GameFeedback();
  private simulation = new SnakeSimulation(
    simulationEffects(this.feedback),
    () => useSettingsStore.getState().bindings,
  );
  private renderer = new SnakeRenderer(this.feedback);
  init(canvas: HTMLCanvasElement, config?: GameConfig) {
    this.simulation.configure(canvas.width, canvas.height, config);
  }
  render(ctx: CanvasRenderingContext2D) {
    this.renderer.render(ctx, this.simulation.getRenderView());
  }
  getInputHints() {
    return this.simulation.getInputHints();
  }
  update(dt: number, input: InputState) {
    return this.simulation.update(dt, input);
  }
  getScore() {
    return this.simulation.getScore();
  }
  getState() {
    return this.simulation.getState();
  }
  setState(state: Record<string, unknown>) {
    return this.simulation.setState(state);
  }
  getResult() {
    return this.simulation.getResult();
  }
  onPause() {
    return this.simulation.onPause();
  }
  onResume() {
    return this.simulation.onResume();
  }
  destroy() {
    this.simulation.destroy();
    this.renderer.destroy();
    this.feedback.clear();
  }
}
