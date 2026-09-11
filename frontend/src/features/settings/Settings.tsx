import { recentMeasurements } from "../../shared/diagnostics/performance";
import { downloadJson } from "../../shared/files/download";
import { pendingResults, flushCompletions } from "../../shared/persistence/sessionQueue";
import { useProfileStore } from "../../shared/state/profileStore";
import { useToast } from "../../shared/ui/useToast";
import { useConfirmation } from "../../shared/ui/useConfirmation";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  usePreferenceStorageUnavailable,
  useSettingsStore,
} from "../../shared/state/settingsStore";
import { useLocalConnection } from "../../shared/network/useLocalConnection";
import { PageHeading } from "../../shared/ui/ConsoleUI";
import { AudioManager } from "../../sdk/AudioManager";
const AutomaticBackups = lazy(() =>
  import("../backups/public").then((module) => ({
    default: module.AutomaticBackups,
  })),
);
export function Settings() {
  const preferences = useSettingsStore();
  const preferencesTemporary = usePreferenceStorageUnavailable();
  const { showToast } = useToast();
  const { ask, confirmation } = useConfirmation();
  const [pending, setPending] = useState(pendingResults),
    [busy, setBusy] = useState(false);
  const [binding, setBinding] = useState<string | null>(null);
  const [showSnapshots, setShowSnapshots] = useState(false);
  useEffect(() => {
    const update = () => setPending(pendingResults());
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("nexus-result-v1:"))
        update();
    };
    window.addEventListener("nexus-progress", update);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("nexus-progress", update);
      window.removeEventListener("storage", storage);
    };
  }, []);
  useEffect(() => {
    if (!binding) return;
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === "Escape") {
        setBinding(null);
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey) {
        showToast("Choose a single key without Ctrl, Alt or Command.", "error");
        return;
      }
      if (
        !/^(Key[A-Z]|Arrow(Up|Down|Left|Right)|Space|Enter)$/.test(event.code)
      )
        return;
      const problem = preferences.setBinding(binding, event.code);
      if (problem) {
        showToast(problem, "error");
        return;
      }
      setBinding(null);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [binding, preferences, showToast]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      showToast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const connection = useLocalConnection();
  return (
    <div className="console-page">
      {confirmation}
      <PageHeading kicker="MAKE IT YOURS" title="Settings">
        Sound, motion, and your local console. Preferences stay in this browser.
      </PageHeading>
      {preferencesTemporary && (
        <p role="status" className="detail-panel">
          Preferences are working for this visit, but browser storage is
          unavailable. Export a backup to keep your current settings before
          closing this page.
        </p>
      )}
      <details className="detail-panel">
        <summary>Local performance measurements</summary>
        <p>
          Recent game frame intervals and initialization times on this browser.
          Budget: 16.7 ms at 60 FPS. Rendering is limited to 60 FPS to reduce
          power use. Games keep Full HD rendering and full scene detail under
          load. Measurements are saved when you leave a game and do not measure
          input latency.
        </p>
        {recentMeasurements().map((sample, i) => (
          <p key={i}>
            {sample.slug} · launch {sample.launchMs} ms · frame p50 {sample.p50}{" "}
            ms / p95 {sample.p95} ms · {sample.slowFrames} frames over 33 ms
            {sample.averageFps != null && ` · ${sample.averageFps} FPS average`}
            {sample.width &&
              sample.height &&
              ` · ${sample.width}×${sample.height}`}
            {sample.quality && ` · ${sample.quality} quality`}
          </p>
        ))}
        <button
          onClick={() =>
            downloadJson(recentMeasurements(), "arcade-performance.json")
          }
        >
          Export measurements
        </button>
      </details>
      <div className="settings-grid">
        <section className="detail-panel">
          <h2>Audio</h2>
          <label htmlFor="volume">
            Sound volume · {Math.round(preferences.volume * 100)}%
          </label>
          <input
            id="volume"
            type="range"
            min={0}
            max={100}
            value={preferences.volume * 100}
            onChange={(e) =>
              preferences.setVolume(Number(e.target.value) / 100)
            }
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={preferences.muted}
              onChange={(e) => preferences.setMuted(e.target.checked)}
            />
            Mute sounds
          </label>
          <button onClick={() => AudioManager.getInstance().playSelect()}>
            Test sound
          </button>
        </section>
        <section className="detail-panel">
          <h2>Display</h2>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={preferences.reducedMotion}
              onChange={(e) => preferences.setReducedMotion(e.target.checked)}
            />
            Reduce animations
          </label>
          <p>
            Full HD graphics preserve scene detail and antialiasing. Resolution
            is not reduced to raise FPS. Games target 60 FPS; actual performance
            depends on your hardware. Press F11 for fullscreen.
          </p>
        </section>
        <section className="detail-panel">
          <h2>Local connection</h2>
          <p role="status">
            {connection.status === "checking"
              ? "Checking…"
              : connection.status === "online"
                ? `Connected · ${connection.latencyMs} ms`
                : "Server unavailable"}
          </p>
        </section>
        <section className="detail-panel">
          <h2>Controls</h2>
          <label htmlFor="dead-zone">
            Stick dead zone · {Math.round(preferences.deadZone * 100)}%
          </label>
          <input
            id="dead-zone"
            type="range"
            min="5"
            max="50"
            value={preferences.deadZone * 100}
            onChange={(e) =>
              preferences.setDeadZone(Number(e.target.value) / 100)
            }
          />
          <p>Remap movement and the primary action. Escape always pauses.</p>
          <p>
            Each key belongs to one action. Pause and secondary game shortcuts
            keep their assigned keys.
          </p>
          <div className="binding-list">
            {["up", "down", "left", "right", "action"].map((action) => (
              <button key={action} onClick={() => setBinding(action)}>
                {action}: {preferences.bindings[action] ?? "Default"}
              </button>
            ))}
          </div>
          {binding && (
            <p role="status">Press a key for {binding}. Escape cancels.</p>
          )}
          <button
            onClick={() => {
              setBinding(null);
              useSettingsStore.setState({ bindings: {} });
            }}
          >
            Reset controls
          </button>
        </section>
        <section className="detail-panel">
          <h2>Pending results</h2>
          <p role="status">
            {pending.length} results awaiting sync
            {pending.some((p) => p.blocked) ? " · Some need attention" : ""}
          </p>
          {pending.map((item) => (
            <p key={item.sessionId}>
              {item.slug} · {item.score} · {item.error ?? "Waiting to sync"}
            </p>
          ))}
          <button
            disabled={busy || !pending.length}
            onClick={() => void run(() => flushCompletions(true))}
          >
            Retry pending results
          </button>
          <button
            disabled={!pending.length}
            onClick={() => downloadJson(pending, "arcade-pending-results.json")}
          >
            Export pending results
          </button>
        </section>
        <section className="detail-panel">
          <h2>Your data</h2>
          <p>
            Profiles, saves and scores are stored by Arcade Nexus on this
            computer. Manage profiles on the Profile page.
          </p>
          <p>
            Export includes every active player, manual and recovery saves,
            records, achievements, browser preferences, and pending results.
            Import creates restored player copies and keeps existing players.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () =>
                (await import("../backups/public")).exportBackup(),
              )
            }
          >
            Export backup
          </button>
          <label className="import-backup">
            Import backup
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file)
                  void run(async () => {
                    const { previewBackup, restoreBackup } =
                      await import("../backups/public");
                    const preview = await previewBackup(file);
                    const names =
                      preview.names.slice(0, 5).join(", ") +
                      (preview.names.length > 5 ? ", …" : "");
                    const answer = await ask({
                      title: "Restore this backup?",
                      message: `${file.name} (${Math.ceil(file.size / 1024)} KB) adds ${preview.profiles} player copies${names ? `: ${names}` : ""}. Includes ${preview.saves} manual saves, ${preview.recoveries + preview.browserRecoveries} recovery snapshots, ${preview.sessions} completed sessions, ${preview.records} records and ${preview.queued} pending results. ${preview.preferences ? "Browser preferences will be replaced. " : ""}${preview.invalid ? `${preview.invalid} invalid browser entries will be skipped. ` : ""}Existing players and their progress are kept.`,
                      confirmText: "Restore backup",
                    });
                    if (answer) {
                      const result = await restoreBackup(file);
                      await useProfileStore.getState().fetchProfiles();
                      showToast(
                        `Restored ${result.imported} players${result.skipped ? `; ${result.skipped} browser entries could not be saved` : ""}.`,
                        "success",
                      );
                    }
                  });
              }}
            />
          </label>
          <details
            onToggle={(event) => setShowSnapshots(event.currentTarget.open)}
          >
            <summary>Automatic backups</summary>
            {showSnapshots && (
              <Suspense fallback={<p role="status">Loading backups…</p>}>
                <AutomaticBackups />
              </Suspense>
            )}
          </details>
          <button onClick={preferences.reset}>Reset preferences</button>
        </section>
      </div>
    </div>
  );
}
