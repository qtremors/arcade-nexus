import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Lock } from "lucide-react";
import { achievementsApi } from "../api/client";
import type { Achievement } from "../api/client";
import { PageHeading, EmptyState, LoadingCards } from "../components/ConsoleUI";
export function Achievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    let active = true;
    void achievementsApi
      .getAll()
      .then((data) => {
        if (active) {
          setAchievements(data.achievements);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const earned = achievements.filter((a) => a.unlocked).length;
  const filtered = achievements.filter(
    (a) => filter === "all" || (filter === "earned" ? a.unlocked : !a.unlocked),
  );
  return (
    <div className="console-page">
      <PageHeading
        kicker="A LITTLE SOMETHING TO AIM FOR"
        title="Achievements"
        aside={
          <div className="award-progress">
            <span>
              <Trophy size={18} />
              {earned} / {achievements.length} earned
            </span>
            <progress
              aria-label="Achievement completion"
              max={Math.max(1, achievements.length)}
              value={earned}
            />
          </div>
        }
      >
        Every milestone tells a story. Choose your next challenge.
      </PageHeading>
      <div className="catalog-tools">
        <div className="filter-pills" aria-label="Filter achievements">
          {[
            ["all", "All achievements"],
            ["earned", "Earned"],
            ["locked", "To unlock"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="result-count" role="status">
          {filtered.length} milestones
        </span>
      </div>
      {loading ? (
        <LoadingCards />
      ) : error ? (
        <EmptyState
          title="Achievements unavailable"
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
      ) : !filtered.length ? (
        <EmptyState
          title={
            filter === "earned"
              ? "Your first milestone awaits"
              : "Nothing here yet"
          }
        >
          Play a game and give yourself something to celebrate.
        </EmptyState>
      ) : (
        <div className="achievement-grid">
          {filtered.map((a) => (
            <article
              className={`achievement-card ${a.unlocked ? "earned" : ""}`}
              key={`${a.game_slug}-${a.slug}`}
            >
              <span className="achievement-icon">
                {a.unlocked ? (
                  a.icon || <Trophy size={24} />
                ) : (
                  <Lock size={24} />
                )}
              </span>
              <p className="eyebrow">{a.game_slug.replaceAll("-", " ")}</p>
              <h2>{a.title}</h2>
              <p>{a.description}</p>
              <div className="achievement-bottom">
                {a.unlocked ? (
                  <span>
                    {a.unlocked_at
                      ? `Earned ${new Date(a.unlocked_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                      : "Earned"}
                  </span>
                ) : (
                  <>
                    <span>Next challenge</span>
                    <Link to={`/play/${a.game_slug}`}>Play game ↗</Link>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
