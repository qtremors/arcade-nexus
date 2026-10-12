import { recentMeasurements } from "../services/performance";
import { exportBackup, restoreBackup, downloadJson } from "../services/backup";
import { pendingResults, flushCompletions } from "../services/sessionQueue";
import { useProfileStore } from "../stores/profileStore";
import { useToast } from "../hooks/useToast";
import { useConfirmation } from "../hooks/useConfirmation";
import { useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { HEALTH_URL } from "../api/client";
import { PageHeading } from "../components/ConsoleUI";
import { AudioManager } from "../sdk/AudioManager";
export function Settings() {
  const preferences = useSettingsStore();
  const { showToast } = useToast();
  const { ask, confirmation } = useConfirmation();
  const [pending, setPending] = useState(pendingResults),
    [busy, setBusy] = useState(false);
  const [binding, setBinding] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setPending(pendingResults());
    window.addEventListener("nexus-progress", update);
    return () => window.removeEventListener("nexus-progress", update);
  }, []);
  useEffect(() => {
    if (!binding) return;
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (
        event.code !== "Escape" &&
        /^(Key[A-Z]|Arrow(Up|Down|Left|Right)|Space|Enter)$/.test(event.code)
      )
        preferences.setBinding(binding, event.code);
      setBinding(null);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [binding, preferences]);
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

  const [connection, setConnection] = useState("Checking…");
  useEffect(() => {
    const controller = new AbortController();
    const check = async () => {
      const before = performance.now();
      try {
        const response = await fetch(HEALTH_URL, { signal: controller.signal });
        if (!controller.signal.aborted)
          setConnection(
            response.ok
              ? `Connected · ${Math.round(performance.now() - before)} ms`
              : "Server unavailable",
          );
      } catch {
        if (!controller.signal.aborted) setConnection("Disconnected");
      }
    };
    void check();
    const timer = setInterval(() => void check(), 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  return (
    <div className="console-page">
      {confirmation}
      <PageHeading kicker="MAKE IT YOURS" title="Settings">
        Sound, motion, and your local console. Preferences stay in this browser.
      </PageHeading>
      <details className="detail-panel">
        <summary>Local performance measurements</summary>
        <p>
          Recent game frame intervals and initialization times on this browser.
          A 60 Hz frame is about 16.7 ms; these measurements are not
          input-latency or GPU certification.
        </p>
        {recentMeasurements().map((sample, i) => (
          <p key={i}>
            {sample.slug} · launch {sample.launchMs} ms · frame p50 {sample.p50}{" "}
            ms / p95 {sample.p95} ms · {sample.slowFrames} frames over 33 ms
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
            Games scale to your browser window. Press F11 for browser
            fullscreen.
          </p>
        </section>
        <section className="detail-panel">
          <h2>Local connection</h2>
          <p role="status">{connection}</p>
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
          <button disabled={busy} onClick={() => void run(exportBackup)}>
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
                  void ask({
                    title: "Restore this backup?",
                    message:
                      "Restored players will be added as copies. Browser preferences will be restored too. Existing players and their progress are kept.",
                    confirmText: "Restore backup",
                  }).then((answer) => {
                    if (answer)
                      void run(async () => {
                        const result = await restoreBackup(file);
                        await useProfileStore.getState().fetchProfiles();
                        showToast(
                          `Restored ${result.imported} players${result.skipped ? `; ${result.skipped} browser entries could not be restored` : ""}.`,
                          "success",
                        );
                      });
                  });
              }}
            />
          </label>
          <button onClick={preferences.reset}>Reset preferences</button>
        </section>
      </div>
    </div>
  );
}
