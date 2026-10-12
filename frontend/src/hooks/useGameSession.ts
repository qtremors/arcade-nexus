import { transition } from "../services/lifecycle";
import type { SessionPhase as State } from "../services/lifecycle";
import { getDescriptor } from "../games/descriptors";
import { dailySeed } from "../sdk/Random";
import { storeRecovery, recoveries, clearRecovery } from "../services/recovery";
import { readSave } from "../services/saves";
import type { SaveEnvelope } from "../services/saves";
import {
  useEffect,
  useRef,
  useState,
  useReducer,
  useCallback,
  useEffectEvent,
} from "react";
import { getExperience } from "../games/experience";
import { useNavigate } from "react-router-dom";
import { GameEngine } from "../sdk";
import { loadGame } from "../games";
import {
  statsApi,
  savesApi,
  getApiProfileId,
  progressApi,
  ApiError,
} from "../api/client";
import type { SaveData, CompletionReceipt } from "../api/client";
import { useToast } from "../hooks/useToast";
import { useGamepad } from "../hooks/useGamepad";
import {
  enqueueCompletion,
  sendCompletion,
  sendCompletionOnExit,
} from "../services/sessionQueue";
import type { Completion } from "../services/sessionQueue";
import { useModalFocus } from "../hooks/useModalFocus";
import { isEditing } from "../sdk/InputManager";
import { useConfirmation } from "../hooks/useConfirmation";
type Difficulty = "easy" | "normal" | "hard";
const emptyConfig = {};
export function useGameSession({
  slug,
  title,
  config = emptyConfig,
}: {
  slug: string;
  title: string;
  config?: Record<string, unknown>;
}) {
  const experience = getExperience(slug);
  const descriptor = getDescriptor(slug);
  const requestedMode = new URLSearchParams(location.search).get("mode");
  const initialMode =
    descriptor.modes.find((m) => m.id === requestedMode)?.id ??
    descriptor.modes[0].id;
  const [mode, setModeState] = useState(initialMode);
  const options = useRef({
    mode: initialMode,
    rules_version: descriptor.rulesVersion,
    config: { ...descriptor.config, ...config } as Record<string, unknown>,
    difficulty: "normal" as Difficulty,
  });
  const setMode = (next: string) => {
    options.current.mode = next;
    options.current.rules_version = descriptor.rulesVersion;
    setModeState(next);
  };
  const [recovery, setRecovery] = useState<SaveEnvelope | null>(null);
  const [receipt, setReceipt] = useState<CompletionReceipt | null>(null);
  const warnedStorage = useRef(false);

  const [controlMode, setControlMode] = useState<"keyboard" | "controller">(
    "keyboard",
  );
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<GameEngine | null>(null);
  const navigate = useNavigate(),
    { showToast } = useToast();
  const { ask, confirmation } = useConfirmation();
  const [state, setState] = useReducer(transition, "loading"),
    [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [score, setScore] = useState(0),
    [highScore, setHighScore] = useState(0),
    [newHigh, setNewHigh] = useState(false);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saves, setSaves] = useState<SaveData[]>([]);
  const busyRef = useRef(false),
    mounted = useRef(false);
  const session = useRef<{
    id: string;
    profileId: number;
    difficulty: Difficulty;
    confirmed: boolean;
    seconds: number;
    since: number | null;
    completion?: Completion;
    mode: string;
    rulesVersion: number;
  } | null>(null);
  const profileId = useRef(getApiProfileId());
  const menuOrigin = useRef<State>("paused");
  const modal = useRef<HTMLDivElement>(null);
  useModalFocus(
    modal,
    state !== "playing" && state !== "loading" && !busy,
    state,
  );
  const stopClock = useCallback(() => {
    const current = session.current;
    if (current?.since !== null && current?.since !== undefined) {
      current.seconds += (performance.now() - current.since) / 1000;
      current.since = null;
    }
  }, []);
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
    [slug],
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
        showToast(
          "Browser recovery storage is unavailable. Keep the local server running and save manually.",
          "error",
        );
      }
      if (mounted.current) setRecovery(value);
    } catch {
      /* A terminal or invalid game state must not overwrite the previous recovery. */
    }
  }, [snapshot, showToast]);
  const completion = useCallback(() => {
    stopClock();
    const current = session.current;
    if (!current?.confirmed) return null;
    if (!current.completion)
      current.completion = {
        slug,
        sessionId: current.id,
        profileId: current.profileId,
        difficulty: current.difficulty,
        seconds: Math.min(604800, Math.floor(current.seconds)),
        score: engine.current?.getScore() ?? 0,
        metrics: engine.current?.getMetrics() ?? {},
        mode: current.mode,
        rulesVersion: current.rulesVersion,
      };
    return current.completion;
  }, [slug, stopClock]);
  const finish = useCallback(async () => {
    const item = completion();
    if (!item) return;
    const persisted = enqueueCompletion(item);
    try {
      const result = await sendCompletion(item);
      if (mounted.current) {
        setReceipt(result);
        setHighScore(result.high_score);
        setNewHigh(result.is_new_high_score);
      }
    } catch (err) {
      if (mounted.current)
        showToast(
          `${persisted ? "Result saved for retry" : "Keep this page open to retry your result"}: ${(err as Error).message}`,
          "error",
        );
    }
  }, [completion, showToast]);
  const generation = useRef(0);
  const prepare = useCallback(
    async (selected: Difficulty, saved?: Record<string, unknown>) => {
      const request = ++generation.current;
      options.current.difficulty = selected;
      if (
        options.current.mode === "daily" &&
        !options.current.config.challenge_date
      )
        options.current.config.challenge_date = new Date()
          .toISOString()
          .slice(0, 10);
      engine.current?.destroy();
      const instance = await loadGame(slug);
      if (
        !mounted.current ||
        request !== generation.current ||
        !canvas.current
      ) {
        instance.destroy?.();
        return;
      }
      const next = new GameEngine();
      engine.current = next;
      next.onPause(() => {
        stopClock();
        checkpoint();
        if (mounted.current) setState("paused");
      });
      next.onGameOver((finalScore) => {
        if (mounted.current) {
          setScore(finalScore);
          setState("gameover");
          stopClock();
          if (!next.recoverable) {
            clearRecovery(profileId.current!, slug, session.current?.id);
            setRecovery(null);
            void finish();
          }
        }
      });
      next.onError((err) => {
        stopClock();
        setError(err.message);
        setState("error");
        void finish();
      });
      try {
        await next.init(canvas.current, instance, {
          ...options.current.config,
          mode: options.current.mode,
          seed:
            options.current.mode === "daily"
              ? dailySeed(slug, String(options.current.config.challenge_date))
              : undefined,
          slug,
          title,
          difficulty: selected,
          width: 960,
          height: 640,
        });
      } catch (err) {
        if (mounted.current && request === generation.current) {
          setError((err as Error).message);
          setState("error");
        }
        throw err;
      }
      if (!mounted.current || request !== generation.current) {
        next.destroy();
        return false;
      }
      if (saved) next.setState(saved);
      return true;
    },
    [slug, title, stopClock, finish, checkpoint],
  );
  useEffect(() => {
    mounted.current = true;
    const revision = generation;
    void prepare("normal")
      .then((ready) => {
        if (ready && mounted.current) setState("ready");
      })
      .catch((err) => {
        if (mounted.current) {
          setError(String(err));
          setState("error");
        }
      });
    const exit = () => {
      checkpoint();
      const item = completion();
      if (item) {
        try {
          enqueueCompletion(item);
          sendCompletionOnExit(item);
        } catch {
          /* Cannot persist when storage is unavailable. */
        }
      }
    };
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted || !session.current?.completion) return;
      // A page restored from the browser cache must not continue a completed UUID.
      engine.current?.stop();
      session.current = null;
      setState("paused");
    };
    window.addEventListener("pageshow", restore);
    window.addEventListener("pagehide", exit);
    return () => {
      exit();
      mounted.current = false;
      revision.current++;
      window.removeEventListener("pagehide", exit);
      window.removeEventListener("pageshow", restore);
      engine.current?.destroy();
      engine.current = null;
    };
  }, [slug, completion, prepare, checkpoint]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) engine.current?.pause();
    };
    const blur = () => engine.current?.pause();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", blur);
    const disconnect = () => {
      engine.current?.pause();
      showToast(
        "Controller disconnected. Reconnect it or use the keyboard.",
        "error",
      );
    };
    window.addEventListener("nexus-controller-disconnected", disconnect);
    const timer = window.setInterval(checkpoint, 5000);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", blur);
      window.removeEventListener("nexus-controller-disconnected", disconnect);
      clearInterval(timer);
    };
  }, [checkpoint, showToast]);
  const act = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const begin = async (selected = difficulty) => {
    if (profileId.current === null) throw new Error("Select a profile to play");
    // Retain the UUID on failed starts: retrying cannot create duplicate sessions.
    const id = session.current?.id ?? crypto.randomUUID();
    session.current = {
      id,
      profileId: profileId.current,
      difficulty: selected,
      confirmed: false,
      seconds: 0,
      since: null,
      mode:
        options.current.mode === "daily"
          ? `daily-${options.current.config.challenge_date}`
          : options.current.mode,
      rulesVersion: options.current.rules_version,
    };
    try {
      await statsApi.startSession(slug, id, profileId.current);
    } catch (error) {
      if (error instanceof ApiError && error.status && error.status < 500)
        throw error;
      showToast(
        "Playing locally. Results will sync when the console reconnects.",
        "info",
      );
    }
    session.current.confirmed = true;
    if (!mounted.current) {
      const item = completion();
      if (item) {
        enqueueCompletion(item);
        sendCompletionOnExit(item);
      }
      return;
    }
    session.current.since = performance.now();
    engine.current?.start();
    setReceipt(null);
    setNewHigh(false);
    checkpoint();
    setState("playing");
  };
  const start = () =>
    act(async () => {
      options.current.rules_version = descriptor.rulesVersion;
      await prepare(difficulty);
      await begin();
    });
  const resume = () => {
    if (busyRef.current) return;
    if (!session.current?.confirmed) {
      void act(() => begin());
      return;
    }
    session.current.since = performance.now();
    engine.current?.resume();
    setState("playing");
  };
  const restart = () =>
    act(async () => {
      engine.current?.pause();
      await finish();
      clearRecovery(profileId.current!, slug, session.current?.id);
      session.current = null;
      options.current.rules_version = descriptor.rulesVersion;
      await prepare(difficulty);
      await begin();
    });
  const quit = () =>
    act(async () => {
      engine.current?.pause();
      checkpoint();
      await finish();
      navigate("/home");
    });
  const openSaves = (mode: "save" | "load") =>
    act(async () => {
      menuOrigin.current = state;
      const data = await savesApi.list(slug, profileId.current ?? undefined);
      setSaves(data.saves);
      setState(mode);
    });
  const saveSlot = (slot: number) =>
    act(async () => {
      if (!engine.current) return;
      if (
        saves.some((s) => s.slot === slot) &&
        !(await ask({
          title: `Replace slot ${slot}?`,
          message:
            "The previous save in this slot will be replaced. Your recovery save and other slots are kept.",
          confirmText: "Replace save",
        }))
      )
        return;
      const data = snapshot();
      await savesApi.create(
        slug,
        slot,
        data,
        `${title} · ${new Date().toLocaleString()}`,
        profileId.current ?? undefined,
      );
      setSaves(
        (await savesApi.list(slug, profileId.current ?? undefined)).saves,
      );
      showToast(`Saved to slot ${slot}`, "success");
    });
  const restore = async (value: unknown) => {
    const data = readSave(value, slug);
    const candidate = await loadGame(slug);
    try {
      candidate.setState?.(data.state);
    } finally {
      candidate.destroy?.();
    }
    await finish();
    session.current = null;
    options.current = {
      mode: data.mode,
      rules_version: data.rules_version,
      config: { ...descriptor.config, ...data.config },
      difficulty: data.difficulty,
    };
    setModeState(data.mode);
    setDifficulty(data.difficulty);
    await prepare(data.difficulty, data.state);
    setScore(engine.current?.getScore() ?? 0);
    setState("paused");
    showToast("Game restored. Resume when ready.", "success");
  };
  const loadSlot = (slot: number) =>
    act(() => restore(saves.find((s) => s.slot === slot)?.data));
  const continueGame = () => act(() => restore(recovery));
  const undoEnd = () => {
    engine.current?.recover();
    if (session.current) session.current.since = performance.now();
    setState("playing");
  };
  useEffect(() => {
    let active = true;
    const id = profileId.current;
    if (id)
      void recoveries(id).then((values) => {
        if (active) setRecovery(values.find((v) => v.game === slug) ?? null);
      });
    return () => {
      active = false;
    };
  }, [slug]);
  const continued = useRef(false);
  const autoContinue = useEffectEvent(() => void continueGame());
  useEffect(() => {
    if (
      state === "ready" &&
      recovery &&
      !continued.current &&
      new URLSearchParams(location.search).has("continue")
    ) {
      continued.current = true;
      autoContinue();
    }
  }, [state, recovery]);
  useEffect(() => {
    let active = true;
    void progressApi
      .records()
      .then((records) => {
        if (active)
          setHighScore(
            records.find(
              (r) =>
                r.game_slug === slug &&
                r.mode ===
                  (mode === "daily"
                    ? `daily-${options.current.config.challenge_date ?? new Date().toISOString().slice(0, 10)}`
                    : mode) &&
                r.difficulty === difficulty &&
                r.rules_version === options.current.rules_version,
            )?.high_score ?? 0,
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug, mode, difficulty]);
  const keyboard = useEffectEvent((event: KeyboardEvent) => {
    if (document.querySelector("dialog[open]")) return;
    if (event.repeat || isEditing(event.target) || busyRef.current) return;
    if (
      (event.code === "Escape" || event.code === "KeyP") &&
      state === "playing"
    ) {
      event.preventDefault();
      engine.current?.pause();
      return;
    }
    if (event.code === "Escape" && state !== "playing") {
      event.preventDefault();
      if (state === "paused") resume();
      else if (state === "save" || state === "load")
        setState(menuOrigin.current);
      else void quit();
    } else if (
      event.code === "Space" &&
      state === "ready" &&
      !(event.target instanceof HTMLButtonElement)
    ) {
      event.preventDefault();
      void start();
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyboard(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useGamepad((button) => {
    if (document.querySelector("dialog[open]")) return;
    if (state === "playing" && button === "Start") {
      engine.current?.pause();
      return;
    }
    if (busyRef.current || state === "playing") return;
    if (button === "B") {
      if (state === "paused") resume();
      else if (state === "save" || state === "load")
        setState(menuOrigin.current);
      else void quit();
    }
    if (button === "A") (document.activeElement as HTMLElement | null)?.click();
    if (["Up", "Down", "Left", "Right"].includes(button)) {
      const targets = Array.from(
        modal.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),summary",
        ) ?? [],
      );
      const at = targets.indexOf(document.activeElement as HTMLElement),
        shift = ["Down", "Right"].includes(button) ? 1 : -1;
      targets[(at + shift + targets.length) % targets.length]?.focus();
    }
  });
  const supportsDifficulty = descriptor.difficulty;
  return {
    canvas,
    engine,
    state,
    setState,
    difficulty,
    setDifficulty,
    mode,
    setMode,
    descriptor,
    recovery,
    continueGame,
    undoEnd,
    receipt,
    score,
    highScore,
    newHigh,
    error,
    busy,
    saves,
    modal,
    experience,
    controlMode,
    setControlMode,
    confirmation,
    ask,
    showToast,
    start,
    resume,
    restart,
    quit,
    openSaves,
    saveSlot,
    loadSlot,
    menuOrigin,
    act,
    profileId,
    setSaves,
    supportsDifficulty,
  };
}
