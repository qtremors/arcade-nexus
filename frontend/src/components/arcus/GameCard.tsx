import { Play, Plus, ArrowUpRight } from "lucide-react";
import type { Game } from "../../api/client";
import { AudioManager } from "../../sdk/AudioManager";
import { getExperience } from "../../games/experience";
import type { CSSProperties } from "react";
interface GameCardProps {
  game: Game;
  onClick: () => void;
  actionLabel?: string;
  variant?: "store" | "library";
  icon?: React.ReactNode;
  disabled?: boolean;
}
export function GameCard({
  game,
  onClick,
  actionLabel = "PLAY",
  variant = "store",
  icon,
  disabled,
}: GameCardProps) {
  const experience = getExperience(game.slug);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${actionLabel} ${game.title}`}
      className="catalog-card"
      style={{ "--game-accent": experience.accent } as CSSProperties}
      onClick={() => {
        AudioManager.getInstance().playSelect();
        onClick();
      }}
    >
      <div className="catalog-art">
        <img src={game.thumbnail || "/games/snake.svg"} alt="" loading="lazy" />
        <span className="art-number">{game.category}</span>
        <ArrowUpRight className="art-arrow" size={20} />
      </div>
      <div className="catalog-content">
        <p className="eyebrow">{experience.mood}</p>
        <h3>{game.title}</h3>
        <p className="catalog-description">{game.description}</p>
        <span className="card-action">
          {icon ??
            (variant === "library" || actionLabel.toLowerCase() === "play" ? (
              <Play size={16} />
            ) : (
              <Plus size={16} />
            ))}
          {actionLabel}
        </span>
      </div>
    </button>
  );
}
