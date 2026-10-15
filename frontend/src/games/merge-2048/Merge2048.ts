import type { Game2DInstance, GameConfig, InputState } from "../../sdk/GameSDK";
import { GameFeedback, simulationEffects } from "../feedback";
import { Merge2048Simulation } from "./Merge2048Simulation";
import { Merge2048Renderer } from "./renderer";
import "./puzzle.css";
import { BoardReader } from "./BoardReader";
export { moveBoard } from "./Merge2048Simulation";
export class Merge2048Game implements Game2DInstance {
  readonly type = "2d" as const;
  private feedback = new GameFeedback();
  private simulation = new Merge2048Simulation(
    simulationEffects(this.feedback),
  );
  private renderer = new Merge2048Renderer(this.feedback);
  private reader = new BoardReader(
    (value) => this.simulation.requestDirection(value),
    () => this.simulation.requestUndo(),
  );
  init(canvas: HTMLCanvasElement, config?: GameConfig) {
    this.simulation.configure(canvas.width, canvas.height, config);
    this.reader.mount(canvas);
    this.reader.sync(this.simulation.getRenderView());
  }
  render(ctx: CanvasRenderingContext2D) {
    this.renderer.render(ctx, this.simulation.getRenderView());
  }
  update(dt: number, input: InputState) {
    const result = this.simulation.update(dt, input);
    this.reader.sync(this.simulation.getRenderView());
    return result;
  }
  getScore() {
    return this.simulation.getScore();
  }
  getState() {
    return this.simulation.getState();
  }
  setState(state: Record<string, unknown>) {
    const result = this.simulation.setState(state);
    this.reader.sync(this.simulation.getRenderView());
    return result;
  }
  getStatus() {
    return this.simulation.getStatus();
  }
  recover() {
    const result = this.simulation.recover();
    this.reader.sync(this.simulation.getRenderView());
    return result;
  }
  getMetrics() {
    return this.simulation.getMetrics();
  }
  getResult() {
    return this.simulation.getResult();
  }
  destroy() {
    this.simulation.destroy();
    this.renderer.destroy();
    this.feedback.clear();
    this.reader.destroy();
  }
}
