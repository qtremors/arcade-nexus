import { useNavigate } from "react-router-dom";
import { Play, ArrowRight, Trophy, Clock3, Gamepad2 } from "lucide-react";
import type { CSSProperties } from "react";
import type { Game } from "../../api/client";
import { useGamepad } from "../../hooks/useGamepad";
import { useProfileStore } from "../../stores/profileStore";
import { formatPlaytime } from "../../utils/formatting";
import { getExperience } from "../../games/experience";
import { isEditing } from "../../sdk/InputManager";
interface GameCarouselProps {
  games: Game[];
  activeIndex: number;
  onSelect: (index: number) => void;
}
export function GameCarousel({
  games,
  activeIndex,
  onSelect,
}: GameCarouselProps) {
  const navigate = useNavigate();
  const overall = useProfileStore((state) => state.overallStats);
  const game = games[activeIndex] ?? games[0];
  useGamepad((button) => {
    if (
      !games.length ||
      document.querySelector('[aria-modal="true"]') ||
      isEditing(document.activeElement)
    )
      return;
    if (button === "Left")
      onSelect((activeIndex - 1 + games.length) % games.length);
    if (button === "Right") onSelect((activeIndex + 1) % games.length);
    if (button === "A") {
      const focused = document.activeElement as HTMLElement | null;
      if (focused?.matches("button, a")) focused.click();
      else if (game) navigate(`/play/${game.slug}`);
    }
  });
  if (!game) return null;
  const experience = getExperience(game.slug);
  const stats = overall?.games.find((stat) => stat.game_slug === game.slug);
  return (
    <div
      className="game-showcase"
      style={{ "--game-accent": experience.accent } as CSSProperties}
    >
      <section className="featured-game" aria-label="Featured game">
        <div className="featured-copy">
          <p className="eyebrow">
            <span className="accent-dot" />
            {stats?.last_session
              ? "Recently played"
              : "Your next favourite"} / {game.category}
          </p>
          <h2>{game.title}</h2>
          <p className="featured-description">{game.description}</p>
          <div className="featured-stats">
            <span>
              <Trophy size={17} />
              <strong>{stats?.high_score?.toLocaleString() ?? "—"}</strong>{" "}
              Personal best
            </span>
            <span>
              <Clock3 size={17} />
              <strong>
                {stats
                  ? formatPlaytime(stats.total_playtime_seconds)
                  : "Fresh start"}
              </strong>{" "}
              Time played
            </span>
          </div>
          <button
            className="primary-action"
            aria-label={`Start ${game.title}`}
            onClick={() => navigate(`/play/${game.slug}`)}
          >
            <Play size={18} fill="currentColor" />
            Play now
            <ArrowRight size={18} />
          </button>
          <p className="featured-note">
            <Gamepad2 size={15} />
            Keyboard & controller · Automatic recovery
          </p>
        </div>
        <div className="featured-art" key={game.slug}>
          <img src={game.thumbnail || "/games/snake.svg"} alt="" />
          <span className="featured-art-caption">{experience.mood}</span>
        </div>
      </section>
      <div className="shelf-heading">
        <h2>Select Experience</h2>
        <span>{games.length} games · Choose your pace</span>
      </div>
      <div className="game-shelf" aria-label="Choose a game">
        {games.map((item, i) => (
          <button
            key={item.id}
            className="shelf-game"
            aria-label={`Select ${item.title}`}
            aria-pressed={i === activeIndex}
            onClick={() => onSelect(i)}
            style={
              {
                "--game-accent": getExperience(item.slug).accent,
              } as CSSProperties
            }
          >
            <img src={item.thumbnail || "/games/snake.svg"} alt="" />
            <span>
              <small>{item.category}</small>
              <strong>{item.title}</strong>
            </span>
            <span className="shelf-dot" />
          </button>
        ))}
      </div>
    </div>
  );
}
