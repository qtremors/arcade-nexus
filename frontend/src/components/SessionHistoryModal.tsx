import { useSessionHistory } from "../hooks/useSessionHistory";
import { useEffect, useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { useGamepad } from "../hooks/useGamepad";
import { formatPlaytime } from "../utils/formatting";
import { activateControl, moveMenuFocus } from "../sdk/menuNavigation";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  gameId?: number;
  initialSort?: "date" | "score" | "duration";
}
export function SessionHistoryModal({
  isOpen,
  onClose,
  title,
  gameId,
  initialSort = "date",
}: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  useModalFocus(dialog, isOpen);
  const {
    page,
    games,
    selectedGame,
    setSelectedGame,
    mode,
    setMode,
    difficulty,
    setDifficulty,
    from,
    setFrom,
    through,
    setThrough,
    filtersError,
    rangeError,
    skip,
    setSkip,
    error,
    loading,
    setLoading,
    setRetry,
    sort,
    setSort,
    rows,
    modes,
    filtering,
  } = useSessionHistory({ isOpen, gameId, initialSort });
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);
  useGamepad((button) => {
    if (!isOpen) return;
    if (button === "B") onClose();
    if (button === "A") activateControl();
    if (["Up", "Down", "Left", "Right"].includes(button)) {
      const focused = document.activeElement;
      if (
        focused instanceof HTMLSelectElement &&
        ["Left", "Right"].includes(button)
      ) {
        focused.selectedIndex = Math.max(
          0,
          Math.min(
            focused.options.length - 1,
            focused.selectedIndex + (button === "Right" ? 1 : -1),
          ),
        );
        focused.dispatchEvent(new Event("change", { bubbles: true }));
      } else
        moveMenuFocus(
          button as "Up" | "Down" | "Left" | "Right",
          dialog.current ?? undefined,
        );
    }
  });
  if (!isOpen) return null;
  return (
    <div
      className="game-overlay"
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <section className="detail-panel history-panel">
        <div className="section-heading">
          <h2>{title}</h2>
          <button onClick={onClose}>Close history</button>
        </div>
        <p>
          Sorted across all matching sessions · {page.total} recorded sessions
        </p>
        <div className="history-filters">
          {!gameId && (
            <label>
              Game
              <select
                value={selectedGame}
                onChange={(event) => {
                  filtering();
                  setSelectedGame(Number(event.target.value));
                  setMode("");
                }}
              >
                <option value={0}>All games</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Mode
            <select
              value={mode}
              onChange={(event) => {
                filtering();
                setMode(event.target.value);
              }}
            >
              <option value="">All modes</option>
              {modes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select
              value={difficulty}
              onChange={(event) => {
                filtering();
                setDifficulty(event.target.value);
              }}
            >
              <option value="">All difficulties</option>
              {["easy", "normal", "hard"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              type="date"
              value={from}
              max={through || undefined}
              onChange={(event) => {
                filtering();
                setFrom(event.target.value);
              }}
            />
          </label>
          <label>
            Through
            <input
              type="date"
              value={through}
              min={from || undefined}
              onChange={(event) => {
                filtering();
                setThrough(event.target.value);
              }}
            />
          </label>
          <button
            onClick={() => {
              filtering();
              setSelectedGame(0);
              setMode("");
              setDifficulty("");
              setFrom("");
              setThrough("");
            }}
          >
            Clear filters
          </button>
        </div>
        {filtersError && (
          <p role="alert">
            History filters unavailable.{" "}
            <button onClick={() => setRetry((n) => n + 1)}>
              Retry filters
            </button>
          </p>
        )}
        {rangeError || error ? (
          <p role="alert">
            {rangeError || error}{" "}
            {!rangeError && (
              <button
                onClick={() => {
                  setLoading(true);
                  setRetry((n) => n + 1);
                }}
              >
                Retry history
              </button>
            )}
          </p>
        ) : loading ? (
          <p role="status">Loading sessions…</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {(
                    [
                      ["game_title", "Game"],
                      ["end_time", "Date"],
                      ["difficulty", "Difficulty"],
                      ["duration_seconds", "Duration"],
                      ["score", "Score"],
                    ] as const
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      aria-sort={
                        sort.key === key
                          ? sort.desc
                            ? "descending"
                            : "ascending"
                          : "none"
                      }
                    >
                      <button
                        onClick={() => {
                          filtering();
                          setSort({
                            key,
                            desc: sort.key === key ? !sort.desc : true,
                          });
                        }}
                      >
                        {label}{" "}
                        {sort.key === key ? (sort.desc ? "↓" : "↑") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.game_title}
                      <small>
                        {row.mode} · rules {row.rules_version}
                      </small>
                    </td>
                    <td>{new Date(row.end_time).toLocaleString()}</td>
                    <td>{row.difficulty ?? "normal"}</td>
                    <td>{formatPlaytime(row.duration_seconds)}</td>
                    <td>{row.score.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p>No completed sessions match these filters.</p>}
          </div>
        )}
        <div className="pagination">
          <button
            disabled={!skip || loading || !!rangeError}
            onClick={() => {
              setLoading(true);
              setSkip((n) => Math.max(0, n - 25));
            }}
          >
            Previous page
          </button>
          <span>
            {page.total
              ? `${skip + 1}–${Math.min(skip + 25, page.total)} of ${page.total}`
              : "0 sessions"}
          </span>
          <button
            disabled={skip + 25 >= page.total || loading || !!rangeError}
            onClick={() => {
              setLoading(true);
              setSkip((n) => n + 25);
            }}
          >
            Next page
          </button>
        </div>
      </section>
    </div>
  );
}
