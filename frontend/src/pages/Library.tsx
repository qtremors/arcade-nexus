import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Trash2 } from "lucide-react";
import { libraryApi } from "../api/client";
import type { LibraryEntry } from "../api/client";
import { GameCard } from "../components/arcus/GameCard";
import { EmptyState, LoadingCards, PageHeading } from "../components/ConsoleUI";
import { useToast } from "../hooks/useToast";
import { useConfirmation } from "../hooks/useConfirmation";
export function Library() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { ask, confirmation } = useConfirmation();
  useEffect(() => {
    let active = true;
    void libraryApi
      .list()
      .then((data) => {
        if (active) {
          setEntries(data);
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
  const remove = async (entry: LibraryEntry) => {
    if (
      !(await ask({
        title: "Remove this game?",
        message: `${entry.game.title} will leave your favorites. Your saves, scores, and achievements are kept.`,
        confirmText: "Remove game",
      }))
    )
      return;
    setRemovingId(entry.game.id);
    try {
      await libraryApi.remove(entry.game.id);
      setEntries((list) => list.filter((e) => e.id !== entry.id));
      showToast("Game removed. Your progress is kept.", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setRemovingId(null);
    }
  };
  const filtered = entries
    .filter((e) =>
      e.game.title.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.game.title.localeCompare(b.game.title)
        : new Date(
            sort === "added" ? b.added_at : (b.last_played ?? b.added_at),
          ).getTime() -
          new Date(
            sort === "added" ? a.added_at : (a.last_played ?? a.added_at),
          ).getTime(),
    );
  return (
    <div className="console-page">
      {confirmation}
      <PageHeading
        kicker="ALL YOUR FAVOURITES"
        title="Favorites"
        aside={
          <button
            className="secondary-action"
            onClick={() => navigate("/games")}
          >
            Discover games ↗
          </button>
        }
      >
        Your collection, ready whenever you are. Saves stay with your player.
      </PageHeading>
      <div className="catalog-tools">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search favorites"
            placeholder="Search your collection…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              aria-label="Clear favorites search"
              onClick={() => setQuery("")}
            >
              <X size={16} />
            </button>
          )}
        </label>
        <label className="filter-field">
          Sort by
          <select
            aria-label="Sort favorites"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Recently played</option>
            <option value="title">Title A–Z</option>
            <option value="added">Recently added</option>
          </select>
        </label>
        <span className="result-count" role="status">
          {filtered.length} of {entries.length} games
        </span>
      </div>
      {loading ? (
        <LoadingCards />
      ) : error ? (
        <EmptyState
          title="Favorites unavailable"
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
      ) : !entries.length ? (
        <EmptyState
          title="No favorites yet"
          action={
            <button
              className="primary-action"
              onClick={() => navigate("/games")}
            >
              Browse games
            </button>
          }
        >
          Find a favourite and add it to your collection.
        </EmptyState>
      ) : !filtered.length ? (
        <EmptyState
          title="No matching games"
          action={
            <button className="secondary-action" onClick={() => setQuery("")}>
              Clear search
            </button>
          }
        >
          Try another title. Your collection is still here.
        </EmptyState>
      ) : (
        <div className="catalog-grid">
          {filtered.map((entry) => (
            <div key={entry.id} className="library-card">
              <GameCard
                game={entry.game}
                variant="library"
                actionLabel="PLAY"
                onClick={() => navigate(`/play/${entry.game.slug}`)}
              />
              <button
                className="remove-game"
                onClick={() => void remove(entry)}
                disabled={removingId !== null}
                aria-label={`Remove ${entry.game.title}`}
                title="Remove from favorites"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
