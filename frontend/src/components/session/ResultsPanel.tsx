import type { SessionUi } from "../../hooks/useGameSession";
import { menuButton } from "./menuButton";
import { formatTime, timeRanked } from "../../games/records";
export function ResultsPanel({
  slug,
  session,
}: {
  slug: string;
  title: string;
  session: SessionUi;
}) {
  const {
    mode,
    receipt,
    score,
    highScore,
    bestTime,
    newHigh,
    recoverable,
    result,
    metrics,
  } = session.view;
  const { restart, quit, undoEnd } = session.commands;
  const button = menuButton(session.view.busy);
  return (
    <>
      <p className="game-final-score">{score}</p>
      <p>Best: {timeRanked(slug, mode) ? formatTime(bestTime) : highScore}</p>
      {receipt &&
        !timeRanked(slug, mode) &&
        (receipt.previous_high_score ?? 0) > 0 && (
          <p>
            {score === receipt.previous_high_score!
              ? "Matched"
              : score > receipt.previous_high_score!
                ? `+${score - receipt.previous_high_score!} above`
                : `${receipt.previous_high_score! - score} below`}{" "}
            your previous best
          </p>
        )}
      {receipt?.previous_best_time_ms &&
        timeRanked(slug, mode) &&
        metrics.completed && (
          <p>
            {(
              Math.abs(metrics.elapsed_ms! - receipt.previous_best_time_ms) /
              1000
            ).toFixed(3)}
            s{" "}
            {metrics.elapsed_ms! < receipt.previous_best_time_ms
              ? "faster than"
              : metrics.elapsed_ms! > receipt.previous_best_time_ms
                ? "slower than"
                : "from"}{" "}
            your previous best
          </p>
        )}
      {(timeRanked(slug, mode) ? receipt?.is_new_best_time : newHigh) &&
        result && <p className="game-best-badge">NEW PERSONAL BEST</p>}
      {result && <p>{result?.detail}</p>}
      {recoverable && (
        <>
          <p>
            You still have one undo. Your result is recorded when you finish
            this run.
          </p>
          {button("Undo last move", undoEnd)}
        </>
      )}
      {receipt?.medal && (
        <p className="game-best-badge">{receipt.medal.toUpperCase()} MEDAL</p>
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
  );
}
