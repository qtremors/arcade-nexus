import { useEffect, useRef, useState } from "react";
import { progressApi } from "../api/client";
import type { GameSession } from "../api/client";
import { useModalFocus } from "../hooks/useModalFocus";
import { useGamepad } from "../hooks/useGamepad";
import { formatPlaytime } from "../utils/formatting";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  gameId?: number;
  sessions: GameSession[];
  loading?: boolean;
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
  const [page, setPage] = useState({ sessions: [] as GameSession[], total: 0 });
  const [skip, setSkip] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  const [sort, setSort] = useState<{
    key:
      "game_title" | "end_time" | "difficulty" | "duration_seconds" | "score";
    desc: boolean;
  }>({
    key:
      initialSort === "score"
        ? "score"
        : initialSort === "duration"
          ? "duration_seconds"
          : "end_time",
    desc: true,
  });
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void progressApi
      .history(skip, 25, gameId)
      .then((data) => {
        if (active) {
          setPage(data);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, skip, retry, gameId]);
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
    if (button === "A") (document.activeElement as HTMLElement)?.click();
    if (["Up", "Down", "Left", "Right"].includes(button)) {
      const buttons = Array.from(
        dialog.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) ?? [],
      );
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[
        (i + (["Up", "Left"].includes(button) ? -1 : 1) + buttons.length) %
          buttons.length
      ]?.focus();
    }
  });
  if (!isOpen) return null;
  const rows = [...page.sessions].sort((a, b) => {
    const av = a[sort.key] ?? "",
      bv = b[sort.key] ?? "";
    return (
      (typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv))) * (sort.desc ? -1 : 1)
    );
  });
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
        <p>Sorted within this page · {page.total} recorded sessions</p>
        {error ? (
          <p role="alert">
            {error}{" "}
            <button onClick={() => setRetry((n) => n + 1)}>
              Retry history
            </button>
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
                        onClick={() =>
                          setSort({
                            key,
                            desc: sort.key === key ? !sort.desc : true,
                          })
                        }
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
            {!rows.length && <p>No completed sessions yet.</p>}
          </div>
        )}
        <div className="pagination">
          <button
            disabled={!skip || loading}
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
            disabled={skip + 25 >= page.total || loading}
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
