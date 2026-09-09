import { useState } from "react";
import { ArrowRight, Gamepad2 } from "lucide-react";
import { useProfileStore } from "../../../shared/state/profileStore";

interface ProfileSetupProps {
  onComplete: () => void;
}

const AVATARS = ["🎮", "👾", "🚀", "⚡", "🎯", "🔥", "💎", "🌟"];

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const [username, setUsername] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("🎮");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProfile = useProfileStore((state) => state.createProfile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Player name required");
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      await createProfile(username.trim(), selectedAvatar);
      onComplete();
    } catch (err) {
      setError((err as Error).message || "Could not create player");
      setIsCreating(false);
    }
  };

  return (
    <div className="player-welcome">
      <div className="setup-panel">
        <div className="welcome-brand">
          <Gamepad2 size={26} />
          <span>ARCADE NEXUS</span>
        </div>
        <p className="eyebrow">YOUR OWN LITTLE ARCADE</p>
        <h1>Create your player</h1>
        <p className="welcome-subtitle">
          A name, an avatar, and a fresh set of personal bests.
        </p>
        <form onSubmit={handleSubmit}>
          <fieldset className="setup-avatars">
            <legend>Choose avatar</legend>
            {AVATARS.map((avatar) => (
              <button
                key={avatar}
                type="button"
                aria-label={`Choose ${avatar}`}
                aria-pressed={selectedAvatar === avatar}
                onClick={() => setSelectedAvatar(avatar)}
              >
                {avatar}
              </button>
            ))}
          </fieldset>
          <label htmlFor="player-name">Player name</label>
          <input
            id="player-name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="What should we call you?"
            maxLength={50}
            required
            autoFocus
            autoComplete="nickname"
          />
          {error && (
            <p className="setup-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-action"
            type="submit"
            disabled={isCreating || !username.trim()}
          >
            {isCreating ? (
              "Creating player…"
            ) : (
              <>
                Create player <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
        <p className="welcome-note">
          Profiles and progress are stored on this computer.
        </p>
      </div>
    </div>
  );
}
