import type { SessionUi } from "../hooks/useGameSession";
import { menuButton } from "./menuButton";
import { Keyboard, Gamepad2 } from "lucide-react";
import { FlightBriefing } from "../../../games/stellar-flight/FlightBriefing";
import { formatTime, timeRanked } from "../../../games/records";
type Difficulty = "easy" | "normal" | "hard";
export function LaunchPanel({
  slug,
  session,
}: {
  slug: string;
  title: string;
  session: SessionUi;
}) {
  const {
    difficulty,
    mode,
    descriptor,
    recovery,
    highScore,
    bestTime,
    busy,
    experience,
    controlMode,
    supportsDifficulty,
    canSave,
  } = session.view;
  const {
    start,
    quit,
    openSaves,
    continueGame,
    chooseDifficulty,
    chooseMode,
    chooseControls,
  } = session.commands;
  const button = menuButton(session.view.busy);
  return (
    <>
      <p className="launch-goal">{experience.goal}</p>
      {slug === "stellar-flight" && <FlightBriefing />}
      <div className="control-guide">
        <div className="controls-switch" aria-label="Control guide">
          {(["keyboard", "controller"] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={controlMode === mode}
              onClick={() => chooseControls(mode)}
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
        Personal best{" "}
        <strong>
          {timeRanked(slug, mode)
            ? formatTime(bestTime)
            : highScore.toLocaleString()}
        </strong>
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
            onClick={() => chooseMode(item.id)}
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
              onClick={() => chooseDifficulty(d)}
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
      {canSave && button("Load game", () => void openSaves("load"))}
      {button("Back to console", () => void quit())}
    </>
  );
}
