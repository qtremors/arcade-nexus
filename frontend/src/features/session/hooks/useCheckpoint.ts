import { useCallback, useRef, type RefObject } from "react";
import type { ActiveRun } from "../services/activeRun";
import type { GameEngine } from "../../../sdk/GameEngine";
import type { SaveEnvelope } from "../../../shared/persistence/saves";
import { storeRecovery } from "../../../shared/persistence/recovery";
import type { ToastType } from "../../../shared/ui/useToast";
export interface RunOptions {
  mode: string;
  rules_version: number;
  config: Record<string, unknown>;
  difficulty: "easy" | "normal" | "hard";
}
export function useCheckpoint({
  slug,
  options,
  session,
  engine,
  mounted,
  onRecovery,
  notify,
}: {
  slug: string;
  options: RefObject<RunOptions>;
  session: RefObject<ActiveRun | null>;
  engine: RefObject<GameEngine | null>;
  mounted: RefObject<boolean>;
  onRecovery: (value: SaveEnvelope) => void;
  notify: (message: string, type?: ToastType) => void;
}) {
  const warnedStorage = useRef(false);
  const snapshot = useCallback(
    (): SaveEnvelope => ({
      format: 2,
      game: slug,
      difficulty: options.current.difficulty,
      mode: options.current.mode,
      rules_version: options.current.rules_version,
      config: options.current.config,
      state: engine.current!.getState(),
      score: engine.current?.getScore() ?? 0,
      session_id: session.current?.id,
      saved_at: new Date().toISOString(),
    }),
    [slug, options, engine, session],
  );
  const checkpoint = useCallback(() => {
    if (
      !session.current ||
      session.current.completion ||
      !engine.current?.canSave
    )
      return;
    try {
      const value = snapshot();
      if (
        !storeRecovery(session.current.profileId, value) &&
        !warnedStorage.current
      ) {
        warnedStorage.current = true;
        notify(
          "Browser recovery storage is unavailable. Keep the local server running and save manually.",
          "error",
        );
      }
      if (mounted.current) onRecovery(value);
    } catch {
      /* A terminal or invalid game state must not overwrite the previous recovery. */
    }
  }, [snapshot, notify, session, engine, mounted, onRecovery]);
  return { snapshot, checkpoint };
}
