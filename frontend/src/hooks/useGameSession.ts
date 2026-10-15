import { useRunCompletion } from "./useRunCompletion";
import { useSessionRuntime } from "./useSessionRuntime";
import { startRun } from "../services/activeRun";
import { useSessionRecords } from "./useSessionRecords";
import { useSessionSlots } from "./useSessionSlots";
import type { GameMetrics } from "../contracts/gameplay";
import { useCheckpoint } from "./useCheckpoint";
import { useSessionMenu } from "./useSessionMenu";
import { completeRun, type ActiveRun } from "../services/activeRun";
import { transition } from "../services/lifecycle";
import { getDescriptor } from "../games/descriptors";
import { recoveries, clearRecovery } from "../services/recovery";
import { validateSave } from "../services/saves";
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
import type { GameEngine } from "../sdk";
import { getApiProfileId } from "../api/client";
import { useToast } from "../hooks/useToast";
import {
  enqueueCompletion,
  sendCompletionOnExit,
} from "../services/sessionQueue";
import { useModalFocus } from "../hooks/useModalFocus";
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

  const [controlMode, setControlMode] = useState<"keyboard" | "controller">(
    "keyboard",
  );
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<GameEngine | null>(null);
  const [runtimeView, setRuntimeView] = useState({
    canSave: false,
    recoverable: false,
    currentScore: 0,
    result: null as ReturnType<GameEngine["getResult"]>,
    metrics: {} as GameMetrics,
  });
  const syncRuntimeView = useCallback(() => {
    const current = engine.current;
    setRuntimeView({
      canSave: current?.canSave ?? false,
      recoverable: current?.recoverable ?? false,
      currentScore: current?.getScore() ?? 0,
      result: current?.getResult() ?? null,
      metrics: current?.getMetrics() ?? {},
    });
  }, []);
  const navigate = useNavigate(),
    { showToast } = useToast();
  const { ask, confirmation } = useConfirmation();
  const [state, setState] = useReducer(transition, "loading"),
    [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [score, setScore] = useState(0);
  const records = useSessionRecords({ slug, mode, difficulty, options });
  const { applyReceipt, resetReceipt } = records.commands;
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const busyRef = useRef(false),
    mounted = useRef(false);
  const session = useRef<ActiveRun | null>(null);
  const profileId = useRef(getApiProfileId());
  const modal = useRef<HTMLDivElement>(null);
  useModalFocus(
    modal,
    state !== "playing" && state !== "loading" && !busy,
    state,
  );
  const { snapshot, checkpoint } = useCheckpoint({
    slug,
    options,
    session,
    engine,
    mounted,
    onRecovery: setRecovery,
    notify: showToast,
  });
  const { stopClock, finish, flushOnExit } = useRunCompletion({
    slug,
    session,
    engine,
    mounted,
    applyReceipt,
    showToast,
  });
  const { prepare } = useSessionRuntime({
    slug,
    title,
    optionsRef: options,
    canvasRef: canvas,
    engineRef: engine,
    sessionRef: session,
    profileIdRef: profileId,
    mountedRef: mounted,
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
  });
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
    const run = session.current;
    const initialScore = engine.current?.getScore() ?? 0;
    const initialMetrics = engine.current?.getMetrics() ?? {};
    await startRun(slug, run, showToast);
    if (!mounted.current || session.current !== run) {
      const item = completeRun(run, slug, initialScore, initialMetrics);
      if (item) {
        enqueueCompletion(item);
        sendCompletionOnExit(item);
      }
      return;
    }
    run.since = performance.now();
    engine.current?.start();
    syncRuntimeView();
    resetReceipt();
    checkpoint();
    setState("playing");
  };
  const start = () =>
    act(async () => {
      options.current.rules_version = descriptor.rulesVersion;
      if (await prepare(difficulty)) await begin();
    });
  const resume = () => {
    if (busyRef.current) return;
    if (!session.current?.confirmed) {
      void act(() => begin());
      return;
    }
    session.current.since = performance.now();
    engine.current?.resume();
    syncRuntimeView();
    setState("playing");
  };
  const restart = () =>
    act(async () => {
      if (
        slug === "stellar-flight" &&
        state === "paused" &&
        !(await ask({
          title: "Start a new journey?",
          message:
            "Starting over resets this journey’s ship upgrades and exploration. Save it to a slot first if you want to return. Your saved slots stay available.",
          confirmText: "Start new journey",
        }))
      )
        return;
      engine.current?.pause();
      await finish();
      clearRecovery(profileId.current!, slug, session.current?.id);
      session.current = null;
      options.current.rules_version = descriptor.rulesVersion;
      if (await prepare(difficulty)) await begin();
    });
  const quit = () =>
    act(async () => {
      engine.current?.pause();
      checkpoint();
      await finish();
      navigate("/home");
    });
  const pause = () => engine.current?.pause();
  const restore = async (value: unknown) => {
    const data = await validateSave(value, slug);
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
    if (!(await prepare(data.difficulty, data.state))) return;
    setScore(engine.current?.getScore() ?? 0);
    setState("paused");
    showToast("Game restored. Resume when ready.", "success");
  };
  const slots = useSessionSlots({
    slug,
    title,
    phase: state,
    profile: profileId,
    snapshot,
    act,
    ask,
    onPhase: setState,
    notify: showToast,
    restore,
  });
  const { openSaves, saveSlot, loadSlot, deleteSlot, closeSlots } =
    slots.commands;
  const continueGame = () => act(() => restore(recovery));
  const undoEnd = () => {
    engine.current?.recover();
    syncRuntimeView();
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
  useSessionMenu({
    state,
    isBusy: () => busyRef.current,
    modal,
    pause,
    resume,
    closeSlots,
    quit,
    start,
  });
  return {
    canvas,
    modal,
    confirmation,
    view: {
      state,
      difficulty,
      mode,
      descriptor: { modes: descriptor.modes },
      recovery,
      score,
      error,
      busy,
      saves: slots.saves,
      experience,
      controlMode,
      supportsDifficulty: descriptor.difficulty,
      ...runtimeView,
      ...records.view,
    } as const,
    commands: {
      start,
      pause,
      resume,
      restart,
      quit,
      openSaves,
      saveSlot,
      loadSlot,
      deleteSlot,
      closeSlots,
      continueGame,
      undoEnd,
      chooseDifficulty: setDifficulty,
      chooseMode: setMode,
      chooseControls: setControlMode,
    } as const,
  };
}
export type SessionUi = ReturnType<typeof useGameSession>;
