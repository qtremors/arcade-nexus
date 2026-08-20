import { HEALTH_URL } from "../../api/client";
import { watchVisibleTask } from "./background";

interface Connection {
  status: "checking" | "online" | "offline";
  latencyMs: number | null;
}
let snapshot: Connection = { status: "checking", latencyMs: null };
const listeners = new Set<() => void>();
let stop: (() => void) | undefined;
let checked = false;
let failures = 0;
export const connectionSnapshot = () => snapshot;
export function subscribeConnection(listener: () => void) {
  listeners.add(listener);
  if (!stop) {
    checked = false;
    stop = watchVisibleTask(
      async (signal) => {
        const request = new AbortController();
        const abort = () => request.abort();
        signal.addEventListener("abort", abort, { once: true });
        const timeout = setTimeout(abort, 5000);
        const before = performance.now();
        try {
          const response = await fetch(HEALTH_URL, { signal: request.signal });
          if (signal.aborted) return;
          snapshot = {
            status: response.ok ? "online" : "offline",
            latencyMs: response.ok
              ? Math.round(performance.now() - before)
              : null,
          };
        } catch {
          if (signal.aborted) return;
          snapshot = { status: "offline", latencyMs: null };
        } finally {
          clearTimeout(timeout);
          signal.removeEventListener("abort", abort);
        }
        checked = true;
        failures = snapshot.status === "online" ? 0 : failures + 1;
        for (const notify of listeners) notify();
      },
      () =>
        !checked
          ? 0
          : failures
            ? Math.min(30000, 5000 * 2 ** Math.min(failures - 1, 3))
            : 30000,
    );
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stop?.();
      stop = undefined;
    }
  };
}
