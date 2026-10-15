import type { SessionUi } from "../../hooks/useGameSession";
import { menuButton } from "./menuButton";
export function PausePanel({
  slug,
  title,
  session,
}: {
  slug: string;
  title: string;
  session: SessionUi;
}) {
  const { experience, canSave, currentScore, result } = session.view;
  const { resume, restart, quit, openSaves } = session.commands;
  const button = menuButton(session.view.busy);
  return (
    <>
      <p className="game-menu-title">{title}</p>
      {slug === "stellar-flight" && (
        <p className="flight-pause-summary">{result?.detail}</p>
      )}
      <div className="game-pause-score">
        {currentScore}
        <span> CURRENT SCORE</span>
      </div>
      <details className="pause-controls">
        <summary>Controls & tips</summary>
        <p>
          {experience.controls
            .map((c) => `${c.action}: ${c.keyboard} / ${c.controller}`)
            .join(" · ")}
        </p>
        <p>{experience.tip}</p>
      </details>
      {button("Resume", resume)}
      {button("Restart", () => void restart())}
      {canSave && (
        <div>
          {button("Save game", () => void openSaves("save"))}
          {button("Load game", () => void openSaves("load"))}
        </div>
      )}
      {button("Quit to console", () => void quit())}
    </>
  );
}
