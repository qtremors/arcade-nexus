/** Schedule useful work only while the console is visible. */
export function watchVisibleTask(
  task: (signal: AbortSignal) => Promise<unknown> | void,
  nextDelay: () => number | null,
  events: string[] = [],
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let running = false;
  let stopped = false;
  const visible = () => document.visibilityState !== "hidden";
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const schedule = (immediate = false) => {
    clear();
    if (stopped || running || !visible()) return;
    const delay = nextDelay();
    if (delay === null) return;
    timer = setTimeout(
      async () => {
        timer = undefined;
        if (stopped || !visible()) return;
        running = true;
        controller = new AbortController();
        try {
          await task(controller.signal);
        } catch {
          /* The owner reports failures; cancellation must not leak rejections. */
        } finally {
          running = false;
          controller = undefined;
          schedule();
        }
      },
      immediate ? 0 : Math.max(0, delay),
    );
  };
  const changed = () => schedule();
  const resumed = () => schedule(true);
  const visibility = () => {
    if (!visible()) {
      clear();
      controller?.abort();
    } else resumed();
  };
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("online", resumed);
  for (const event of events) window.addEventListener(event, changed);
  schedule();
  return () => {
    stopped = true;
    clear();
    controller?.abort();
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("online", resumed);
    for (const event of events) window.removeEventListener(event, changed);
  };
}
