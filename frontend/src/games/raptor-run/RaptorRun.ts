import type { Game2DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { GameFeedback, simulationEffects } from "../feedback";
import { RaptorSimulation } from "./RaptorSimulation";
import { renderRaptor } from "./renderer";
/** Browser renderer/effects adapter; durable rules live in the DOM-free simulation. */
export class RaptorRunGame implements Game2DInstance {
  readonly type = "2d" as const;
  private feedback = new GameFeedback();
  private simulation = new RaptorSimulation(simulationEffects(this.feedback));
  getInputHints() {
    const view = this.simulation.getRenderView();
    return {
      raptor: {
        obstacles: view.obstacles,
        speed: view.gameSpeed,
        jumping: view.isJumping,
      },
    };
  }
  init(canvas: HTMLCanvasElement, config?: GameConfig) {
    this.simulation.configure(canvas.width, canvas.height, config);
  }
  update(dt: number, input: InputState) {
    return this.simulation.update(dt, input);
  }
  render(ctx: CanvasRenderingContext2D) {
    renderRaptor(ctx, this.simulation.getRenderView(), this.feedback);
  }
  getState() {
    return this.simulation.getState();
  }
  setState(state: Record<string, unknown>) {
    this.simulation.setState(state);
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
  onPause() {
    this.simulation.onPause();
  }
  onResume() {
    this.simulation.onResume();
  }
  destroy() {
    this.simulation.destroy();
    this.feedback.clear();
  }
}
