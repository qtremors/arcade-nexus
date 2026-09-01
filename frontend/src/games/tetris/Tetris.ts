import type { Game2DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { GameFeedback, simulationEffects } from "../feedback";
import { TetrisSimulation } from "./TetrisSimulation";
import { TetrisRenderer } from "./renderer";
export class TetrisGame implements Game2DInstance {
  readonly type = "2d" as const;
  private feedback = new GameFeedback();
  private simulation = new TetrisSimulation(simulationEffects(this.feedback));
  private renderer = new TetrisRenderer(this.feedback);
  init(canvas: HTMLCanvasElement, config?: GameConfig) {
    this.simulation.configure(canvas.width, canvas.height, config);
  }
  render(ctx: CanvasRenderingContext2D) {
    this.renderer.render(ctx, this.simulation.getRenderView());
  }
  update(dt: number, input: InputState) {
    return this.simulation.update(dt, input);
  }
  getScore() {
    return this.simulation.getScore();
  }
  getMetrics() {
    return this.simulation.getMetrics();
  }
  getResult() {
    return this.simulation.getResult();
  }
  getState() {
    return this.simulation.getState();
  }
  setState(state: Record<string, unknown>) {
    return this.simulation.setState(state);
  }
  destroy() {
    this.simulation.destroy();
    this.renderer.destroy();
    this.feedback.clear();
  }
}
