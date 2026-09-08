import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Check } from "lucide-react";
import { gamesApi, libraryApi } from "../../api/client";
import type { Game } from "../../api/client";
import { GameCard } from "./components/GameCard";
import { EmptyState, LoadingCards, PageHeading } from "../../shared/ui/ConsoleUI";
import { useToast } from "../../shared/ui/useToast";
export function Store() {
  const [games, setGames] = useState<Game[]>([]);
  const [libraryGameIds, setLibraryGameIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingGameId, setAddingGameId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const navigate = useNavigate();
  const { showToast } = useToast();
  useEffect(() => {
    let active = true;
    void Promise.all([gamesApi.list(), libraryApi.list()])
      .then(([catalog, library]) => {
        if (active) {
          setGames(catalog.games);
          setLibraryGameIds(new Set(library.map((e) => e.game.id)));
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
  const filtered = games.filter(
    (g) =>
      (!selectedCategory || g.category === selectedCategory) &&
      `${g.title} ${g.description ?? ""}`
        .toLowerCase()
        .includes(searchQuery.trim().toLowerCase()),
  );
  const categories = [...new Set(games.map((g) => g.category))].sort();
  const add = async (game: Game) => {
    setAddingGameId(game.id);
    try {
      if (libraryGameIds.has(game.id)) {
        await libraryApi.remove(game.id);
        setLibraryGameIds(
          (ids) => new Set([...ids].filter((id) => id !== game.id)),
        );
        showToast(`${game.title} removed from favorites`, "success");
        return;
      }
      await libraryApi.add(game.id);
      setLibraryGameIds((ids) => new Set([...ids, game.id]));
      showToast(`${game.title} added to favorites`, "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setAddingGameId(null);
    }
  };
  return (
    <div className="console-page">
      <PageHeading
        kicker="DISCOVER SOMETHING GOOD"
        title="Games"
        aside={
          <span className="pill">
            <Check size={14} />
            Included with your console
          </span>
        }
      >
        Small escapes. Big personal bests. All ready to play locally.
      </PageHeading>
      <div className="catalog-tools">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search games"
            placeholder="Find your next game…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              aria-label="Clear games search"
              onClick={() => setSearchQuery("")}
            >
              <X size={16} />
            </button>
          )}
        </label>
        <label className="filter-field">
          Category
          <select
            aria-label="Game category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <span className="result-count" role="status">
          {filtered.length} {filtered.length === 1 ? "game" : "games"}
        </span>
      </div>
      {loading ? (
        <LoadingCards />
      ) : error ? (
        <EmptyState
          title="Games unavailable"
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
          title="No games found"
          action={
            <button
              className="secondary-action"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("");
              }}
            >
              Clear filters
            </button>
          }
        >
          Try another title or category.
        </EmptyState>
      ) : (
        <div className="catalog-grid">
          {filtered.map((game) => (
            <div className="catalog-entry" key={game.id}>
              <GameCard
                key={game.id}
                game={game}
                variant="store"
                actionLabel="Play"
                disabled={addingGameId !== null}
                onClick={() => navigate(`/play/${game.slug}`)}
              />
              <button
                className="favorite-toggle"
                aria-pressed={libraryGameIds.has(game.id)}
                aria-label={`${libraryGameIds.has(game.id) ? "Unfavorite" : "Favorite"} ${game.title}`}
                disabled={addingGameId !== null}
                onClick={() => void add(game)}
              >
                {libraryGameIds.has(game.id) ? "★ Favorited" : "☆ Favorite"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
