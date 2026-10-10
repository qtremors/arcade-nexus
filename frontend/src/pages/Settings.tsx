import { useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { HEALTH_URL } from "../api/client";
import { PageHeading } from "../components/ConsoleUI";
import { AudioManager } from "../sdk/AudioManager";
export function Settings() {
  const preferences = useSettingsStore();
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
      <PageHeading kicker="MAKE IT YOURS" title="Settings">
        Sound, motion, and your local console. Preferences stay in this browser.
      </PageHeading>
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
          <h2>Your data</h2>
          <p>
            Profiles, saves and scores are stored by Arcade Nexus on this
            computer. Manage profiles on the Profile page.
          </p>
          <button onClick={preferences.reset}>Reset preferences</button>
        </section>
      </div>
    </div>
  );
}
