import { graphicsCapabilities } from "./GraphicsQuality";

/** Cache unchanged artwork at the destination's physical resolution. */
export class CanvasLayer {
  private canvas: HTMLCanvasElement | null = null;
  private key: unknown;
  private valid = false;

  draw(
    target: CanvasRenderingContext2D,
    width: number,
    height: number,
    key: unknown,
    paint: (ctx: CanvasRenderingContext2D) => void,
  ): void {
    const physicalWidth = target.canvas.width,
      physicalHeight = target.canvas.height;
    this.canvas ??= document.createElement("canvas");
    if (
      !this.valid ||
      this.key !== key ||
      this.canvas.width !== physicalWidth ||
      this.canvas.height !== physicalHeight
    ) {
      this.canvas.width = physicalWidth;
      this.canvas.height = physicalHeight;
      const ctx = this.canvas.getContext("2d", {
        willReadFrequently: graphicsCapabilities().software,
      });
      if (!ctx) {
        paint(target);
        return;
      }
      ctx.setTransform(
        physicalWidth / width,
        0,
        0,
        physicalHeight / height,
        0,
        0,
      );
      paint(ctx);
      this.key = key;
      this.valid = true;
    }
    target.drawImage(this.canvas, 0, 0, width, height);
  }

  destroy(): void {
    if (this.canvas) this.canvas.width = this.canvas.height = 0;
    this.canvas = null;
    this.key = undefined;
    this.valid = false;
  }
}
