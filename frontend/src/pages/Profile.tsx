import { PageHeading } from "../components/ConsoleUI";
import { useEffect, useState } from "react";
import { useConfirmation } from "../hooks/useConfirmation";
import { useProfileStore } from "../stores/profileStore";
import { useLibraryStore } from "../stores/libraryStore";
import { achievementsApi } from "../api/client";
import { formatPlaytime } from "../utils/formatting";
import { SessionHistoryModal } from "../components/SessionHistoryModal";
import { useToast } from "../hooks/useToast";
const avatars = ["🎮", "👾", "🚀", "⚡", "🎯", "🔥", "💎", "🌟"];
export function Profile() {
  const { ask, confirmation } = useConfirmation();
  const {
    activeProfile,
    profiles,
    updateProfile,
    switchProfile,
    createProfile,
    deleteProfile,
    overallStats,
    fetchOverallStats,
  } = useProfileStore();
  const { entries, fetchLibrary } = useLibraryStore();
  const [name, setName] = useState(activeProfile?.username ?? ""),
    [avatar, setAvatar] = useState(activeProfile?.avatar ?? "🎮");
  const [newName, setNewName] = useState("");
  const [awards, setAwards] = useState({ total: 0, unlocked: 0 }),
    [history, setHistory] = useState(false),
    [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchOverallStats(true),
      fetchLibrary(),
      achievementsApi.summary(),
    ])
      .then(([, , achievements]) => {
        if (active) {
          setAwards({
            total: achievements.total,
            unlocked: achievements.unlocked_count,
          });
        }
      })
      .catch((err) => {
        if (active) showToast((err as Error).message, "error");
      });
    return () => {
      active = false;
    };
  }, [fetchOverallStats, fetchLibrary, showToast]);
  if (!activeProfile) return null;
  return (
    <div className="console-page">
      {confirmation}
      <PageHeading kicker="YOUR ARCADE, YOUR PROGRESS" title="Player profile">
        Your games, personal bests, and a little history.
      </PageHeading>
      <div className="profile-summary">
        <span className="profile-avatar">{activeProfile.avatar}</span>
        <div>
          <h2>{activeProfile.username}</h2>
          <p>
            Playing since{" "}
            {new Date(activeProfile.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="stats-grid">
        {[
          [
            "Playtime",
            formatPlaytime(overallStats?.total_playtime_seconds ?? 0),
          ],
          ["Sessions", overallStats?.total_sessions ?? 0],
          ["Favorites", entries.length],
          ["Achievements", `${awards.unlocked} / ${awards.total}`],
        ].map(([label, value]) => (
          <div className="detail-panel" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="profile-panels">
        <section className="detail-panel">
          <h2>Edit profile</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await updateProfile(activeProfile.id, {
                  username: name.trim(),
                  avatar,
                });
                showToast("Profile updated", "success");
              });
            }}
          >
            <label htmlFor="profile-name">Player name</label>
            <input
              id="profile-name"
              value={name}
              maxLength={50}
              required
              onChange={(e) => setName(e.target.value)}
            />
            <fieldset className="avatar-options">
              <legend>Avatar</legend>
              {avatars.map((a) => (
                <button
                  type="button"
                  key={a}
                  aria-pressed={avatar === a}
                  aria-label={`Choose ${a}`}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </fieldset>
            <button disabled={busy || !name.trim()}>Save profile</button>
          </form>
        </section>
        <section className="detail-panel">
          <h2>Switch player</h2>
          <div className="profile-choices">
            {profiles.map((p) => (
              <div key={p.id}>
                <button
                  disabled={busy || p.id === activeProfile.id}
                  onClick={() => void run(() => switchProfile(p.id))}
                >
                  {p.avatar} {p.username}
                  {p.id === activeProfile.id ? " · Playing" : ""}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    void ask({
                      title: `Remove ${p.username}?`,
                      message:
                        "This player will disappear from the console. Stored progress is retained in the database.",
                      confirmText: "Remove player",
                    }).then((answer) => {
                      if (answer) void run(() => deleteProfile(p.id));
                    });
                  }}
                >
                  Remove {p.username}
                </button>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => createProfile(newName.trim(), "🎮"));
            }}
          >
            <label htmlFor="new-player">New player name</label>
            <input
              id="new-player"
              maxLength={50}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <button disabled={busy || !newName.trim()}>Create player</button>
          </form>
        </section>
      </div>
      <section className="detail-panel">
        <h2>Game progress</h2>
        {overallStats?.games.length ? (
          <div className="progress-list">
            {overallStats.games.map((game) => (
              <div key={game.game_slug}>
                <strong>{game.game_title}</strong>
                <span>
                  {game.sessions_count} sessions ·{" "}
                  {formatPlaytime(game.total_playtime_seconds)} · Best{" "}
                  {game.high_score}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p>Play a game to start your history.</p>
        )}
        <button onClick={() => setHistory(true)}>Session history</button>
      </section>
      {history && (
        <SessionHistoryModal
          isOpen
          onClose={() => setHistory(false)}
          title="Recent sessions"
        />
      )}
    </div>
  );
}
