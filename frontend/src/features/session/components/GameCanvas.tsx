import type { CSSProperties } from "react";
import { useGameSession } from "../hooks/useGameSession";
import { useToast } from "../../../shared/ui/useToast";
import { menuButton } from "./menuButton";
import { LaunchPanel } from "./LaunchPanel";
import { PausePanel } from "./PausePanel";
import { ResultsPanel } from "./ResultsPanel";
import { SlotsPanel } from "./SlotsPanel";
export function GameCanvas(props: {
  slug: string;
  title: string;
  config?: Record<string, unknown>;
}) {
  const { slug, title } = props;
  const session = useGameSession(props);
  const { canvas, modal, confirmation } = session;
  const { state, experience, newHigh, result, busy, error } = session.view;
  const { pause, quit } = session.commands;
  const { showToast } = useToast();
  const button = menuButton(busy);
  return (
    <div className="game-stage" data-game={slug} data-state={state}>
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
            <button onClick={() => pause()}>Pause (Esc / P)</button>
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
                      ? (result?.title ??
                        (newHigh ? "New high score!" : "Game over"))
                      : state === "error"
                        ? "Game unavailable"
                        : state === "save"
                          ? "Save game"
                          : "Load game"}
              </h1>
              {state === "ready" && (
                <LaunchPanel slug={slug} title={title} session={session} />
              )}
              {state === "paused" && (
                <PausePanel slug={slug} title={title} session={session} />
              )}
              {state === "gameover" && (
                <ResultsPanel slug={slug} title={title} session={session} />
              )}
              {state === "error" && (
                <>
                  <p role="alert">{error}</p>
                  {button("Back to console", () => void quit())}
                </>
              )}
              {(state === "save" || state === "load") && (
                <SlotsPanel slug={slug} title={title} session={session} />
              )}
              {busy && <p role="status">Working…</p>}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
