import { useEffect, useState } from "react";
import { API_BASE_URL, dataApi } from "../../api/client";
import type { BackupStatus, SnapshotInfo } from "../../api/client";
import { useConfirmation } from "../../shared/ui/useConfirmation";
import { useToast } from "../../shared/ui/useToast";
import { useProfileStore } from "../../shared/state/profileStore";

export function AutomaticBackups() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const { ask, confirmation } = useConfirmation();
  const { showToast } = useToast();
  useEffect(() => {
    let active = true;
    void dataApi
      .backups()
      .then((value) => {
        if (active) {
          setStatus(value);
          setError("");
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const restore = async (snapshot: SnapshotInfo) => {
    const preview = await dataApi.previewSnapshot(snapshot.name);
    const answer = await ask({
      title: "Restore automatic backup?",
      message: `The copy from ${new Date(snapshot.created_at).toLocaleString()} adds ${preview.profiles} player copies with ${preview.saves} manual saves, ${preview.recoveries} recovery snapshots and ${preview.sessions} completed sessions. It contains server-saved progress. Browser preferences and pending results stay as they are. Existing players are kept.`,
      confirmText: "Restore player copies",
    });
    if (!answer) return;
    const result = await dataApi.restoreSnapshot(snapshot.name);
    await useProfileStore.getState().fetchProfiles();
    showToast(`Restored ${result.imported} players.`, "success");
  };
  return (
    <div className="automatic-backups">
      {confirmation}
      <p>
        Automatic copies keep server-saved players and progress. Use Export
        backup to include this browser’s preferences and unsynced data.
      </p>
      {status ? (
        <p>
          {status.enabled
            ? `Keeps the latest ${status.retention} copies, with a scheduled copy every ${status.interval_hours} hours while the console runs.`
            : "Automatic copies are disabled for this console."}
        </p>
      ) : (
        <p role="status">Loading backup list…</p>
      )}
      {(error || status?.error) && <p role="alert">{error || status?.error}</p>}
      <div className="button-row">
        <button
          disabled={busy}
          onClick={() => {
            setError("");
            setRetry((value) => value + 1);
          }}
        >
          Refresh backups
        </button>
        <button
          disabled={busy || !status?.enabled}
          onClick={() =>
            void run(async () => {
              await dataApi.createSnapshot();
              setRetry((value) => value + 1);
              showToast("Backup created.", "success");
            })
          }
        >
          Create backup now
        </button>
      </div>
      {status?.backups.length === 0 && (
        <p>
          No automatic copies yet. A copy is created after there is player data
          to save.
        </p>
      )}
      <ul>
        {status?.backups.map((snapshot) => (
          <li key={snapshot.name}>
            <span>
              {new Date(snapshot.created_at).toLocaleString()} ·{" "}
              {Math.ceil(snapshot.bytes / 1024)} KB
            </span>{" "}
            <a
              href={`${API_BASE_URL}/data/backups/${encodeURIComponent(snapshot.name)}`}
              download
            >
              Download backup
            </a>{" "}
            <button
              disabled={busy}
              onClick={() => void run(() => restore(snapshot))}
            >
              Restore copy
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
