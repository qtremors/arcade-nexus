import {
  useCallback,
  useEffect,
  useRef,
  type RefObject,
  type Dispatch,
} from "react";
import { loadGame } from "../../../games";
import { getDescriptor } from "../../../games/descriptors";
import { createGameEngine } from "../../../shared/runtime/gameRuntime";
import { dailySeed } from "../../../sdk/Random";
import { clearRecovery } from "../../../shared/persistence/recovery";
import { watchVisibleTask } from "../../../shared/network/background";
import type { GameEngine } from "../../../sdk";
import type { RunOptions } from "./useCheckpoint";
import type { ActiveRun } from "../services/activeRun";
import type { SaveEnvelope } from "../../../contracts/saves";
import type { SessionPhase } from "../services/lifecycle";
import type { ToastType } from "../../../shared/ui/useToast";
type Difficulty = RunOptions["difficulty"];
/** Sole owner of engineRef creation/disposal, generation cancellation and browser events. */
export function useSessionRuntime({
  slug,
  title,
  optionsRef,
  canvasRef,
  engineRef,
  sessionRef,
  profileIdRef,
  mountedRef,
  state,
  setState,
  setError,
  setScore,
  setRecovery,
  syncRuntimeView,
  stopClock,
  checkpoint,
  finish,
  flushOnExit,
  showToast,
}: {
  slug: string;
  title: string;
  optionsRef: RefObject<RunOptions>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  engineRef: RefObject<GameEngine | null>;
  sessionRef: RefObject<ActiveRun | null>;
  profileIdRef: RefObject<number | null>;
  mountedRef: RefObject<boolean>;
  state: SessionPhase;
  setState: Dispatch<SessionPhase>;
  setError: (value: string) => void;
  setScore: (value: number) => void;
  setRecovery: (value: SaveEnvelope | null) => void;
  syncRuntimeView: () => void;
  stopClock: () => void;
  checkpoint: () => void;
  finish: () => Promise<void>;
  flushOnExit: () => void;
  showToast: (message: string, type?: ToastType) => void;
}) {
  const generation = useRef(0);
  const prepare = useCallback(
    async (selected: Difficulty, saved?: Record<string, unknown>) => {
      const request = ++generation.current;
      optionsRef.current.difficulty = selected;
      if (
        optionsRef.current.mode === "daily" &&
        !optionsRef.current.config.challenge_date
      )
        optionsRef.current.config.challenge_date = new Date()
          .toISOString()
          .slice(0, 10);
      engineRef.current?.destroy();
      engineRef.current = null;
      const codec = await getDescriptor(slug).codec();
      if (
        !mountedRef.current ||
        request !== generation.current ||
        !canvasRef.current
      )
        return false;
      const instance = await loadGame(slug);
      if (
        !mountedRef.current ||
        request !== generation.current ||
        !canvasRef.current
      ) {
        instance.destroy?.();
        return;
      }
      const next = createGameEngine(codec.parseState);
      const current = () =>
        mountedRef.current && request === generation.current;
      engineRef.current = next;
      next.onPause(() => {
        if (!current()) return;
        syncRuntimeView();
        stopClock();
        checkpoint();
        if (mountedRef.current) setState("paused");
      });
      next.onGameOver((finalScore) => {
        if (!current()) return;
        syncRuntimeView();
        if (mountedRef.current) {
          setScore(finalScore);
          setState("gameover");
          stopClock();
          if (!next.recoverable) {
            clearRecovery(profileIdRef.current!, slug, sessionRef.current?.id);
            setRecovery(null);
            void finish();
          }
        }
      });
      next.onError((err) => {
        if (!current()) return;
        syncRuntimeView();
        stopClock();
        setError(err.message);
        setState("error");
        void finish();
      });
      try {
        await next.init(canvasRef.current, instance, {
          ...optionsRef.current.config,
          mode: optionsRef.current.mode,
          seed:
            optionsRef.current.mode === "daily"
              ? dailySeed(
                  slug,
                  String(optionsRef.current.config.challenge_date),
                )
              : undefined,
          slug,
          title,
          difficulty: selected,
          width: 960,
          height: 640,
        });
      } catch (err) {
        next.destroy();
        if (engineRef.current === next) engineRef.current = null;
        if (mountedRef.current && request === generation.current) {
          setError((err as Error).message);
          setState("error");
        }
        throw err;
      }
      if (!mountedRef.current || request !== generation.current) {
        next.destroy();
        return false;
      }
      try {
        if (saved) next.setState(saved);
      } catch (error) {
        next.destroy();
        engineRef.current = null;
        throw error;
      }
      syncRuntimeView();
      return true;
    },
    [
      slug,
      title,
      stopClock,
      finish,
      checkpoint,
      syncRuntimeView,
      optionsRef,
      mountedRef,
      canvasRef,
      engineRef,
      profileIdRef,
      sessionRef,
      setState,
      setError,
      setScore,
      setRecovery,
    ],
  );
  useEffect(() => {
    mountedRef.current = true;
    const revision = generation;
    void prepare("normal")
      .then((ready) => {
        if (ready && mountedRef.current) setState("ready");
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(String(err));
          setState("error");
        }
      });
    const exit = () => {
      checkpoint();
      flushOnExit();
    };
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted || !sessionRef.current?.completion) return;
      // A page restored from the browser cache must not continue a completed UUID.
      engineRef.current?.stop();
      sessionRef.current = null;
      setState("paused");
    };
    window.addEventListener("pageshow", restore);
    window.addEventListener("pagehide", exit);
    return () => {
      exit();
      mountedRef.current = false;
      revision.current++;
      window.removeEventListener("pagehide", exit);
      window.removeEventListener("pageshow", restore);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [
    slug,
    flushOnExit,
    prepare,
    checkpoint,
    engineRef,
    mountedRef,
    sessionRef,
    setError,
    setState,
  ]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) engineRef.current?.pause();
    };
    const blur = () => engineRef.current?.pause();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", blur);
    const disconnect = () => {
      engineRef.current?.pause();
      showToast(
        "Controller disconnected. Reconnect it or use the keyboard.",
        "error",
      );
    };
    window.addEventListener("nexus-controller-disconnected", disconnect);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", blur);
      window.removeEventListener("nexus-controller-disconnected", disconnect);
    };
  }, [checkpoint, showToast, engineRef]);
  useEffect(() => {
    if (state !== "playing") return;
    return watchVisibleTask(
      () => checkpoint(),
      () => 5000,
    );
  }, [state, checkpoint]);
  return { prepare };
}
