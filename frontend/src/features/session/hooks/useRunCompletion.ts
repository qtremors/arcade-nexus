import { useCallback, type RefObject } from "react";
import type { GameEngine } from "../../../sdk";
import {
  completeRun,
  stopRunClock,
  type ActiveRun,
} from "../services/activeRun";
import {
  enqueueCompletion,
  sendCompletion,
  sendCompletionOnExit,
} from "../../../shared/persistence/sessionQueue";
import type { CompletionReceipt } from "../../../api/client";
import type { ToastType } from "../../../shared/ui/useToast";
/** One cached receipt payload per run, independently of engine resource ownership. */
export function useRunCompletion({
  slug,
  session,
  engine,
  mounted,
  applyReceipt,
  showToast,
}: {
  slug: string;
  session: RefObject<ActiveRun | null>;
  engine: RefObject<GameEngine | null>;
  mounted: RefObject<boolean>;
  applyReceipt: (receipt: CompletionReceipt) => void;
  showToast: (message: string, type?: ToastType) => void;
}) {
  const stopClock = useCallback(() => {
    stopRunClock(session.current, performance.now());
  }, [session]);
  const completion = useCallback(() => {
    stopClock();
    return completeRun(
      session.current,
      slug,
      engine.current?.getScore() ?? 0,
      engine.current?.getMetrics() ?? {},
    );
  }, [slug, stopClock, session, engine]);
  const finish = useCallback(async () => {
    const item = completion();
    if (!item) return;
    let persisted = false;
    try {
      persisted = enqueueCompletion(item);
      const result = await sendCompletion(item);
      if (mounted.current && session.current?.id === item.sessionId) {
        applyReceipt(result);
      }
    } catch (err) {
      if (mounted.current)
        showToast(
          `${persisted ? "Result saved for retry" : "Keep this page open to retry your result"}: ${(err as Error).message}`,
          "error",
        );
    }
  }, [completion, showToast, applyReceipt, mounted, session]);

  const flushOnExit = useCallback(() => {
    const item = completion();
    if (item) {
      try {
        enqueueCompletion(item);
        sendCompletionOnExit(item);
      } catch {
        /* A departing page cannot wait for storage or the network. */
      }
    }
  }, [completion]);
  return { stopClock, finish, flushOnExit };
}
