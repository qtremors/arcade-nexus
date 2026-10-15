import { useState, useEffect } from "react";
import { progressApi, type GameSession, type HistoryGame } from "../api/client";
/** Owns filter/query lifetimes; the modal owns focus and controller navigation. */
export function useSessionHistory({
  isOpen,
  gameId,
  initialSort = "date",
}: {
  isOpen: boolean;
  gameId?: number;
  initialSort?: "date" | "score" | "duration";
}) {
  const [page, setPage] = useState({ sessions: [] as GameSession[], total: 0 });
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [selectedGame, setSelectedGame] = useState(0);
  const [mode, setMode] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const [filtersError, setFiltersError] = useState("");
  const rangeError =
    from && through && from > through
      ? "Choose an end date on or after the start date."
      : "";
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
    if (!isOpen || rangeError) return;
    let active = true;
    const before = through ? new Date(`${through}T00:00:00`) : undefined;
    before?.setDate(before.getDate() + 1);
    void progressApi
      .history(skip, 25, gameId ?? (selectedGame || undefined), {
        mode: mode || undefined,
        difficulty: difficulty || undefined,
        since: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        before: before?.toISOString(),
        sort: sort.key,
        direction: sort.desc ? "desc" : "asc",
      })
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
  }, [
    isOpen,
    skip,
    retry,
    gameId,
    selectedGame,
    mode,
    difficulty,
    from,
    through,
    rangeError,
    sort,
  ]);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void progressApi
      .historyOptions()
      .then((data) => {
        if (active) {
          setGames(data.games);
          setFiltersError("");
        }
      })
      .catch((error) => {
        if (active) setFiltersError(error.message);
      });
    return () => {
      active = false;
    };
  }, [isOpen, retry]);
  const rows = page.sessions;
  const modes = [
    ...new Set(
      games
        .filter(
          (game) =>
            !(gameId ?? selectedGame) || game.id === (gameId ?? selectedGame),
        )
        .flatMap((game) => game.modes),
    ),
  ].sort();
  const filtering = () => {
    setSkip(0);
    setLoading(true);
    setError("");
  };
  return {
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
  };
}
