import type { Game2DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { GameFeedback, simulationEffects } from "../feedback";
import { BreakoutSimulation } from "./BreakoutSimulation";
import { BreakoutRenderer } from "./renderer";
export class BreakoutGame implements Game2DInstance {
  readonly type = "2d" as const;
  private feedback = new GameFeedback();
  private simulation = new BreakoutSimulation(simulationEffects(this.feedback));
  private renderer = new BreakoutRenderer(this.feedback);
  init(canvas: HTMLCanvasElement, config?: GameConfig) {
    this.simulation.configure(canvas.width, canvas.height, config);
  }
  render(ctx: CanvasRenderingContext2D) {
    this.renderer.render(ctx, this.simulation.getRenderView());
  }
  getInputHints() {
    return this.simulation.getInputHints();
  }
  update(milliseconds: number, input: InputState) {
    return this.simulation.update(milliseconds, input);
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
