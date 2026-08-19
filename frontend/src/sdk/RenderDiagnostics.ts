import type { WebGLRenderer } from "three";
import type { RenderDiagnostics } from "./GameSDK";

export function renderDiagnostics(
  renderer: WebGLRenderer | null | undefined,
): RenderDiagnostics | null {
  if (!renderer) return null;
  const gl = renderer.getContext();
  const extension = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    renderer: extension
      ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL))
      : null,
    antialias: gl.getContextAttributes()?.antialias ?? false,
    frame: () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    }),
    resources: () => ({ ...renderer.info.memory }),
  };
}
