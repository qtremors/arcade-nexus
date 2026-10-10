import { useEffect, useState, useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { gamesApi } from "../api/client";
import type { Game } from "../api/client";
import { isEditing } from "../sdk/InputManager";
import { useProfileStore } from "../stores/profileStore";
import { GameCarousel } from "../components/arcus/GameCarousel";
import { EmptyState, LoadingCards, PageHeading } from "../components/ConsoleUI";
export function Dashboard() {
  const [games, setGames] = useState<Game[]>([]);
  const { overallStats, activeProfile, fetchOverallStats } = useProfileStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void gamesApi
      .list()
      .then((data) => {
        if (active) {
          setGames(data.games);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void fetchOverallStats(true);
    return () => {
      active = false;
    };
  }, [fetchOverallStats, retry]);
  const displayGames = useMemo(() => {
    const stats = overallStats?.games ?? [];
    return [...games].sort((a, b) => {
      const last = (slug: string) =>
        new Date(
          stats.find((s) => s.game_slug === slug)?.last_session ?? 0,
        ).getTime();
      return last(b.slug) - last(a.slug);
    });
  }, [games, overallStats]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        !displayGames.length ||
        isEditing(e.target) ||
        document.querySelector('[aria-modal="true"]') ||
        (e.target instanceof HTMLElement && e.target.closest("header"))
      )
        return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveIndex(
          (i) =>
            (i + (e.key === "ArrowRight" ? 1 : -1) + displayGames.length) %
            displayGames.length,
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [displayGames.length]);
  return (
    <div className="console-page home-page">
      <PageHeading
        kicker="YOUR PERSONAL ARCADE"
        title={`Good to see you${activeProfile ? `, ${activeProfile.username}` : ""}.`}
        aside={
          <Link className="text-link" to="/library">
            Your library <ArrowUpRight size={15} />
          </Link>
        }
      >
        A quick escape. A new best. A game at your own pace.
      </PageHeading>
      {loading ? (
        <LoadingCards />
      ) : error ? (
        <EmptyState
          title="Can’t load your games"
          action={
            <button
              className="primary-action"
              onClick={() => {
                setLoading(true);
                setRetry((i) => i + 1);
              }}
            >
              Try again
            </button>
          }
        >
          {error}
        </EmptyState>
      ) : !games.length ? (
        <EmptyState title="No games available">
          Your local game catalog is empty.
        </EmptyState>
      ) : (
        <GameCarousel
          games={displayGames}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
        />
      )}
      <div className="home-footnote">
        <span>
          <kbd>←</kbd> <kbd>→</kbd> Browse games
        </span>
        <span>All games run locally. Make yourself at home.</span>
      </div>
    </div>
  );
}
