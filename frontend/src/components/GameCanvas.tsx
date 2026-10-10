import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useEffectEvent,
} from "react";
import type { CSSProperties } from "react";
import { getExperience } from "../games/experience";
import { Keyboard, Gamepad2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GameEngine } from "../sdk";
import { loadGame } from "../games";
import { statsApi, savesApi, getApiProfileId } from "../api/client";
import type { SaveData } from "../api/client";
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
import { AudioManager } from "../sdk/AudioManager";
import { useConfirmation } from "../hooks/useConfirmation";
type Difficulty = "easy" | "normal" | "hard";
type State =
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "gameover"
  | "save"
  | "load"
  | "error";
const hints: Record<string, string> = {
  snake:
    "Arrow keys or WASD to turn. Eat pink packets; avoid walls and your body.",
  "raptor-run":
    "Up or Space: jump • Down: duck / fall faster. Survive as long as you can.",
  "stellar-flight":
    "Arrows / WASD: pitch and roll • Q/E: yaw • Shift/Ctrl: throttle • 1–3: planet. Fly through cyan gates and avoid the ground. Score is peak speed.",
  breakout:
    "Left / Right or A/D: paddle • Space: launch. Clear three sectors with three lives. Aim with the paddle edges.",
  "merge-2048":
    "Arrows / WASD: slide tiles • Z / controller B: undo once. Merge matching numbers and reach 2048.",
};
const emptyConfig = {};
export function GameCanvas({
  slug,
  title,
  config = emptyConfig,
}: {
  slug: string;
  title: string;
  config?: Record<string, unknown>;
}) {
  const experience = getExperience(slug);
  const [controlMode, setControlMode] = useState<"keyboard" | "controller">(
    "keyboard",
  );
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<GameEngine | null>(null);
  const navigate = useNavigate(),
    { showToast } = useToast();
  const { ask, confirmation } = useConfirmation();
  const [state, setState] = useState<State>("loading"),
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
        if (mounted.current) setState("paused");
      });
      next.onGameOver((finalScore) => {
        if (mounted.current) {
          setScore(finalScore);
          setState("gameover");
          void finish();
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
          ...config,
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
    [config, slug, title, stopClock, finish],
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
    void statsApi
      .getForGame(slug, profileId.current ?? undefined)
      .then((data) => {
        if (mounted.current) setHighScore(data.high_score);
      })
      .catch(() => {});
    const exit = () => {
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
  }, [slug, completion, prepare]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) engine.current?.pause();
    };
    const blur = () => engine.current?.pause();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", blur);
    };
  }, []);
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
    };
    await statsApi.startSession(slug, id, profileId.current);
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
    setNewHigh(false);
    setState("playing");
  };
  const start = () =>
    act(async () => {
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
      session.current = null;
      await prepare(difficulty);
      await begin();
    });
  const quit = () =>
    act(async () => {
      engine.current?.pause();
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
      const data = {
        format: 1,
        game: slug,
        difficulty,
        state: engine.current.getState(),
      };
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
  const loadSlot = (slot: number) =>
    act(async () => {
      const data = saves.find((s) => s.slot === slot)?.data;
      if (
        !data ||
        data.format !== 1 ||
        data.game !== slug ||
        !["easy", "normal", "hard"].includes(String(data.difficulty)) ||
        !data.state ||
        typeof data.state !== "object"
      )
        throw new Error(
          "This save uses an unsupported format. Start a new game to create a full save.",
        );
      // Validate against a temporary game before replacing the current run.
      const candidate = await loadGame(slug);
      try {
        candidate.setState?.(data.state as Record<string, unknown>);
      } finally {
        candidate.destroy?.();
      }
      await finish();
      session.current = null;
      const selected = data.difficulty as Difficulty;
      setDifficulty(selected);
      await prepare(selected, data.state as Record<string, unknown>);
      setScore(engine.current?.getScore() ?? 0);
      setState("paused");
      showToast("Game restored. Resume when ready.", "success");
    });
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
  const supportsDifficulty = ["snake", "raptor-run", "breakout"].includes(slug);
  const button = (label: string, onClick: () => void, disabled = false) => (
    <button
      disabled={busy || disabled}
      onClick={() => {
        AudioManager.getInstance().unlock();
        onClick();
      }}
      data-primary={
        ["Start game", "Resume", "Play again"].includes(label) || undefined
      }
      className="game-button"
    >
      {label}
    </button>
  );
  return (
    <div className="game-stage" data-state={state}>
      {confirmation}
      <canvas
        ref={canvas}
        className="game-canvas"
        width={960}
        height={640}
        aria-label={`${title} playfield`}
      />
      {state === "playing" && (
        <div className="game-toolbar">
          <span>
            <span className="game-live-dot" />
            {title}
          </span>
          <div>
            {document.documentElement.requestFullscreen && (
              <button
                onClick={() => {
                  const action = document.fullscreenElement
                    ? document.exitFullscreen()
                    : document.documentElement.requestFullscreen();
                  void action.catch(() =>
                    showToast(
                      "Fullscreen is unavailable in this browser.",
                      "error",
                    ),
                  );
                }}
              >
                Fullscreen
              </button>
            )}
            <button onClick={() => engine.current?.pause()}>
              Pause (Esc / P)
            </button>
          </div>
        </div>
      )}
      {state !== "playing" && (
        <div
          ref={modal}
          className="game-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {state === "loading" ? (
            <p role="status">Loading {title}…</p>
          ) : (
            <section
              className="game-menu-panel"
              data-state={state}
              style={{ "--game-accent": experience.accent } as CSSProperties}
            >
              <div className="game-menu-kicker">
                ARCADE NEXUS{" "}
                <span>
                  /{" "}
                  {state === "ready"
                    ? "READY TO PLAY"
                    : state === "paused"
                      ? "SESSION PAUSED"
                      : state === "gameover"
                        ? "RESULTS"
                        : "SESSION"}
                </span>
              </div>
              <h1>
                {state === "ready"
                  ? title
                  : state === "paused"
                    ? "Paused"
                    : state === "gameover"
                      ? (engine.current?.getResult()?.title ??
                        (newHigh ? "New high score!" : "Game over"))
                      : state === "error"
                        ? "Game unavailable"
                        : state === "save"
                          ? "Save game"
                          : "Load game"}
              </h1>
              {state === "ready" && (
                <>
                  <p className="launch-goal">{experience.goal}</p>
                  <div className="control-guide">
                    <div className="controls-switch" aria-label="Control guide">
                      {(["keyboard", "controller"] as const).map((mode) => (
                        <button
                          key={mode}
                          aria-pressed={controlMode === mode}
                          onClick={() => setControlMode(mode)}
                        >
                          {mode === "keyboard" ? (
                            <Keyboard size={15} />
                          ) : (
                            <Gamepad2 size={15} />
                          )}
                          {mode === "keyboard" ? "Keyboard" : "Controller"}
                        </button>
                      ))}
                    </div>
                    <dl>
                      {[
                        ...experience.controls,
                        {
                          action: "Pause",
                          keyboard: "Esc / P",
                          controller: "Start",
                        },
                      ].map((control) => (
                        <div key={control.action}>
                          <dt>{control.action}</dt>
                          <dd>{control[controlMode]}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <p className="launch-record">
                    Personal best <strong>{highScore.toLocaleString()}</strong>
                    <span>Save your run from the pause menu</span>
                  </p>
                  {supportsDifficulty && (
                    <fieldset>
                      <legend>Difficulty</legend>
                      {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
                        <button
                          key={d}
                          disabled={busy}
                          aria-pressed={difficulty === d}
                          onClick={() => setDifficulty(d)}
                          className="game-button"
                        >
                          {d}
                        </button>
                      ))}
                    </fieldset>
                  )}
                  {button("Start game", () => void start())}
                  {engine.current?.canSave &&
                    button("Load game", () => void openSaves("load"))}
                  {button("Back to console", () => void quit())}
                </>
              )}
              {state === "paused" && (
                <>
                  <p className="game-menu-title">{title}</p>
                  <div className="game-pause-score">
                    {engine.current?.getScore() ?? 0}
                    <span> CURRENT SCORE</span>
                  </div>
                  <details className="pause-controls">
                    <summary>Controls & tips</summary>
                    <p>{hints[slug]}</p>
                    <p>{experience.tip}</p>
                  </details>
                  {button("Resume", resume)}
                  {button("Restart", () => void restart())}
                  {engine.current?.canSave && (
                    <div>
                      {button("Save game", () => void openSaves("save"))}
                      {button("Load game", () => void openSaves("load"))}
                    </div>
                  )}
                  {button("Quit to console", () => void quit())}
                </>
              )}
              {state === "gameover" && (
                <>
                  <p className="game-final-score">{score}</p>
                  <p>Best: {highScore}</p>
                  {newHigh && engine.current?.getResult() && (
                    <p className="game-best-badge">NEW PERSONAL BEST</p>
                  )}
                  {engine.current?.getResult() && (
                    <p>{engine.current.getResult()?.detail}</p>
                  )}
                  {button("Play again", () => void restart())}
                  {button("Back to console", () => void quit())}
                </>
              )}
              {state === "error" && (
                <>
                  <p role="alert">{error}</p>
                  {button("Back to console", () => void quit())}
                </>
              )}
              {(state === "save" || state === "load") && (
                <>
                  <div className="save-slots">
                    {[1, 2, 3, 4, 5].map((slot) => {
                      const entry = saves.find((s) => s.slot === slot);
                      return (
                        <div key={slot}>
                          {button(
                            `Slot ${slot} · ${entry?.name ?? "Empty"}`,
                            () =>
                              void (state === "save"
                                ? saveSlot(slot)
                                : loadSlot(slot)),
                            state === "load" && !entry,
                          )}
                          {entry &&
                            button(`Delete slot ${slot}`, () => {
                              void ask({
                                title: `Delete slot ${slot}?`,
                                message:
                                  "This saved run will be permanently removed. Other slots and recorded scores are kept.",
                                confirmText: "Delete save",
                              }).then((answer) => {
                                if (answer)
                                  void act(async () => {
                                    await savesApi.delete(
                                      slug,
                                      slot,
                                      profileId.current ?? undefined,
                                    );
                                    setSaves(
                                      (
                                        await savesApi.list(
                                          slug,
                                          profileId.current ?? undefined,
                                        )
                                      ).saves,
                                    );
                                  });
                              });
                            })}
                        </div>
                      );
                    })}
                  </div>
                  {button("Back", () => setState(menuOrigin.current))}
                </>
              )}
              {busy && <p role="status">Working…</p>}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
