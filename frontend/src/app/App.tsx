import { lazy, Suspense, useState, useEffect } from "react";
import type { ComponentType } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./shell/Layout";
import { BootSequence } from "./BootSequence";
import { ProfileSetup } from "../features/profiles/components/ProfileSetup";
import { ProfileSelector } from "../features/profiles/components/ProfileSelector";
import { ToastProvider } from "../shared/ui/Toast";
import { useProfileStore } from "../shared/state/profileStore";
import { useSettingsStore } from "../shared/state/settingsStore";
import { startCompletionSync } from "../shared/persistence/sessionQueue";
import { watchVisibleTask } from "../shared/network/background";
import "./App.css";
import { ControllerKeyboard } from "../shared/input/ControllerKeyboard";
const Dashboard = lazy(() =>
  import("../features/home/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Store = lazy(() =>
  import("../features/catalog/Store").then((m) => ({ default: m.Store })),
);
const Library = lazy(() =>
  import("../features/catalog/Library").then((m) => ({ default: m.Library })),
);
const Profile = lazy(() =>
  import("../features/profiles/Profile").then((m) => ({ default: m.Profile })),
);
const Achievements = lazy(() =>
  import("../features/progress/Achievements").then((m) => ({ default: m.Achievements })),
);
const Progress = lazy(() =>
  import("../features/progress/Progress").then((m) => ({ default: m.Progress })),
);
const Settings = lazy(() =>
  import("../features/settings/Settings").then((m) => ({ default: m.Settings })),
);
const GamePlayer = lazy(() =>
  import("../features/session/GamePlayer").then((m) => ({ default: m.GamePlayer })),
);
function screen(Page: ComponentType) {
  return (
    <Suspense
      fallback={
        <div className="startup-panel" role="status">
          Loading page…
        </div>
      }
    >
      <Page />
    </Suspense>
  );
}
const hasBooted = () => {
  try {
    return sessionStorage.getItem("arcade_nexus_session_booted") === "true";
  } catch {
    return true;
  }
};
function App() {
  const [booted, setBooted] = useState(hasBooted);
  const [creating, setCreating] = useState(false);
  const {
    initialize,
    activeProfile,
    profiles,
    isInitialized,
    isLoading,
    error,
  } = useProfileStore();
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    if (!error || isInitialized) return;
    return watchVisibleTask(
      () => initialize(),
      () => 5000,
    );
  }, [error, isInitialized, initialize]);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  }, [reducedMotion]);
  const activeId = activeProfile?.id;
  useEffect(() => {
    if (!activeId) return;
    return startCompletionSync();
  }, [activeId]);
  let content;
  if (!isInitialized)
    content = error ? (
      <div className="startup-panel">
        <h1>Console unavailable</h1>
        <p>{error}</p>
        <p>Start Arcade Nexus and retry the connection.</p>
        <button disabled={isLoading} onClick={() => void initialize()}>
          Retry Connection
        </button>
      </div>
    ) : (
      <div className="startup-panel" role="status">
        Starting Arcade Nexus…
      </div>
    );
  else if (!booted)
    content = (
      <BootSequence
        onComplete={() => {
          try {
            sessionStorage.setItem("arcade_nexus_session_booted", "true");
          } catch {
            /* optional */
          }
          setBooted(true);
        }}
      />
    );
  else if (creating || !profiles.length)
    content = <ProfileSetup onComplete={() => setCreating(false)} />;
  else if (!activeProfile)
    content = (
      <ProfileSelector
        onSelect={() => setCreating(false)}
        onCreateNew={() => setCreating(true)}
      />
    );
  else
    content = (
      <BrowserRouter key={activeProfile.id}>
        <Routes>
          <Route path="/play/:slug" element={screen(GamePlayer)} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="home" element={screen(Dashboard)} />
            <Route path="games" element={screen(Store)} />
            <Route path="store" element={<Navigate to="/games" replace />} />
            <Route path="favorites" element={screen(Library)} />
            <Route
              path="library"
              element={<Navigate to="/favorites" replace />}
            />
            <Route path="progress" element={screen(Progress)} />
            <Route path="profile" element={screen(Profile)} />
            <Route path="achievements" element={screen(Achievements)} />
            <Route path="settings" element={screen(Settings)} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    );
  return (
    <ToastProvider>
      <div className="app-root">{content}</div>
      <ControllerKeyboard />
    </ToastProvider>
  );
}
export default App;
