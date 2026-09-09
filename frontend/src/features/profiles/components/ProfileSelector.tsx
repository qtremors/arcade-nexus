import { useToast } from "../../../shared/ui/useToast";
import { useProfileStore } from "../../../shared/state/profileStore";
import { Plus, Gamepad2 } from "lucide-react";

interface ProfileSelectorProps {
  onSelect: () => void;
  onCreateNew: () => void;
}

export function ProfileSelector({
  onSelect,
  onCreateNew,
}: ProfileSelectorProps) {
  const { showToast } = useToast();
  const { profiles, switchProfile, isLoading } = useProfileStore();

  const handleSelectProfile = async (id: number) => {
    try {
      await switchProfile(id);
      onSelect();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  return (
    <div className="player-welcome">
      <div className="welcome-content">
        <div className="welcome-brand">
          <Gamepad2 size={28} />
          <span>ARCADE NEXUS</span>
        </div>
        <p className="eyebrow">A LITTLE TIME FOR YOU</p>
        <h1>Who’s playing?</h1>
        <p className="welcome-subtitle">
          Pick a player. Your favourites and progress will be waiting.
        </p>
        <div className="welcome-players">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              disabled={isLoading}
              onClick={() => void handleSelectProfile(profile.id)}
            >
              <span>{profile.avatar ?? "🎮"}</span>
              <strong>{profile.username}</strong>
              <small>Jump in ↗</small>
            </button>
          ))}
          <button
            className="new-player-tile"
            disabled={isLoading}
            onClick={onCreateNew}
          >
            <span>
              <Plus size={32} />
            </span>
            <strong>New player</strong>
            <small>Make it yours</small>
          </button>
        </div>
        <p className="welcome-note">
          Local profiles. Personal bests. All on this computer.
        </p>
      </div>
    </div>
  );
}
