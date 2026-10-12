import type { CSSProperties } from "react";
import { Keyboard, Gamepad2 } from "lucide-react";
import { AudioManager } from "../sdk/AudioManager";
import { savesApi } from "../api/client";
import { useGameSession } from "../hooks/useGameSession";
type Difficulty = "easy" | "normal" | "hard";
export function GameCanvas(props: {
  slug: string;
  title: string;
  config?: Record<string, unknown>;
}) {
  const { slug, title } = props;
  const {
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
  } = useGameSession(props);
  const button = (label: string, onClick: () => void, disabled = false) => (
    <button
      disabled={busy || disabled}
      onClick={() => {
        AudioManager.getInstance().unlock();
        onClick();
      }}
      data-primary={
        [
          "Start game",
          "Resume",
          "Play again",
          "Continue saved run",
          "Undo last move",
        ].includes(label) || undefined
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
                  <fieldset className="mode-choices">
                    <legend>Mode</legend>
                    {descriptor.modes.map((item) => (
                      <button
                        key={item.id}
                        className="game-button"
                        disabled={busy}
                        aria-pressed={mode === item.id}
                        onClick={() => setMode(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </fieldset>
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
                  {recovery && (
                    <div className="recovery-summary">
                      <p>
                        Saved{" "}
                        {recovery.saved_at
                          ? new Date(recovery.saved_at).toLocaleString()
                          : "run"}{" "}
                        · {recovery.score} points · {recovery.mode}
                      </p>
                      {button("Continue saved run", () => void continueGame())}
                    </div>
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
                    <p>
                      {experience.controls
                        .map(
                          (c) => `${c.action}: ${c.keyboard} / ${c.controller}`,
                        )
                        .join(" · ")}
                    </p>
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
                  {engine.current?.recoverable && (
                    <>
                      <p>
                        You still have one undo. Your result is recorded when
                        you finish this run.
                      </p>
                      {button("Undo last move", undoEnd)}
                    </>
                  )}
                  {receipt?.medal && (
                    <p className="game-best-badge">
                      {receipt.medal.toUpperCase()} MEDAL
                    </p>
                  )}
                  {!!receipt?.awards?.length && (
                    <div aria-label="New achievements">
                      <h2>New achievements</h2>
                      {receipt.awards.map((award) => (
                        <p key={award.slug}>★ {award.title}</p>
                      ))}
                    </div>
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
                            `Slot ${slot} · ${entry ? entry.name || "Saved run" : "Empty"}`,
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
