export interface GraphicsCapabilities {
  software: boolean;
  renderer: string | null;
}
let capabilities: GraphicsCapabilities | undefined;
/** Probe once, release the probe context, and keep hardware canvas acceleration on real GPUs. */
export function graphicsCapabilities(): GraphicsCapabilities {
  if (capabilities) return capabilities;
  capabilities = { software: false, renderer: null };
  if (typeof WebGLRenderingContext === "undefined") return capabilities;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  try {
    const gl =
      canvas.getContext("webgl2", { antialias: false }) ??
      canvas.getContext("webgl", { antialias: false });
    if (!gl) return capabilities;
    const details = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      gl.getParameter(details ? details.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    );
    capabilities = {
      software:
        /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(
          renderer,
        ),
      renderer,
    };
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* Opaque/blocked renderer information leaves the normal hardware path intact. */
  }
  return capabilities;
}

/** Full HD backing buffer, preserving the game's aspect ratio. Never reduced under load. */
export function fullHdScale(width: number, height: number): number {
  return Math.min(1920 / Math.max(1, width), 1080 / Math.max(1, height));
}
