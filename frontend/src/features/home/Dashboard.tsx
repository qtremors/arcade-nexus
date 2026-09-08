import { recoveries } from "../../shared/persistence/recovery";
import type { SaveEnvelope } from "../../shared/persistence/saves";
import { useEffect, useState, useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { gamesApi } from "../../api/client";
import type { Game } from "../../api/client";
import { isEditing } from "../../sdk/InputManager";
import { useProfileStore } from "../../shared/state/profileStore";
import { GameCarousel } from "../catalog/public";
import { EmptyState, LoadingCards, PageHeading } from "../../shared/ui/ConsoleUI";
export function Dashboard() {
  const [saved, setSaved] = useState<SaveEnvelope[]>([]);
  const [statsError, setStatsError] = useState("");
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
    void fetchOverallStats(true)
      .then(() => {
        if (active) setStatsError("");
      })
      .catch((err) => {
        if (active) setStatsError(err.message);
      });
    if (activeProfile)
      void recoveries(activeProfile.id).then((data) => {
        if (active) setSaved(data);
      });
    return () => {
      active = false;
    };
  }, [fetchOverallStats, retry, activeProfile]);
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
          <Link className="text-link" to="/favorites">
            Your favorites <ArrowUpRight size={15} />
          </Link>
        }
      >
        A quick escape. A new best. A game at your own pace.
      </PageHeading>
      {statsError && (
        <p role="alert">
          Records are temporarily unavailable.{" "}
          <button onClick={() => setRetry((n) => n + 1)}>Retry records</button>
        </p>
      )}
      {!!saved.length && (
        <section className="continue-shelf" aria-label="Continue playing">
          <h2>Continue playing</h2>
          <div>
            {saved.map((save) => (
              <Link
                className="detail-panel continue-card"
                key={save.game}
                to={`/play/${save.game}?continue=1`}
              >
                <strong>
                  {games.find((g) => g.slug === save.game)?.title ?? save.game}
                </strong>
                <span>
                  {save.score.toLocaleString()} · {save.mode} ·{" "}
                  {save.difficulty}
                </span>
                <small>
                  {save.saved_at
                    ? new Date(save.saved_at).toLocaleString()
                    : "Saved run"}
                </small>
                <b>Continue →</b>
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="daily-challenge detail-panel">
        <div>
          <strong>Today's trail</strong>
          <p>
            One shared Raptor layout. Switch players and beat a household best.
          </p>
        </div>
        <Link className="secondary-action" to="/play/raptor-run?mode=daily">
          Play daily challenge
        </Link>
      </div>
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
