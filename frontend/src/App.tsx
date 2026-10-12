import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { Store } from "./pages/Store";
import { Library } from "./pages/Library";
import { Profile } from "./pages/Profile";
import { Achievements } from "./pages/Achievements";
import { Progress } from "./pages/Progress";
import { Settings } from "./pages/Settings";
import { GamePlayer } from "./pages/GamePlayer";
import { Layout } from "./components/Layout";
import { BootSequence } from "./components/arcus/BootSequence";
import { ProfileSetup } from "./components/arcus/ProfileSetup";
import { ProfileSelector } from "./components/arcus/ProfileSelector";
import { ToastProvider } from "./components/Toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useProfileStore } from "./stores/profileStore";
import { useSettingsStore } from "./stores/settingsStore";
import { flushCompletions } from "./services/sessionQueue";
import "./App.css";
import { ControllerKeyboard } from "./components/ControllerKeyboard";
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
    const timer = window.setInterval(() => {
      void initialize();
    }, 5000);
    return () => clearInterval(timer);
  }, [error, isInitialized, initialize]);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  }, [reducedMotion]);
  const activeId = activeProfile?.id;
  useEffect(() => {
    if (!activeId) return;
    void flushCompletions();
    const timer = window.setInterval(() => void flushCompletions(), 30000);
    return () => clearInterval(timer);
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
          <Route path="/play/:slug" element={<GamePlayer />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="home" element={<Dashboard />} />
            <Route path="games" element={<Store />} />
            <Route path="store" element={<Navigate to="/games" replace />} />
            <Route path="favorites" element={<Library />} />
            <Route
              path="library"
              element={<Navigate to="/favorites" replace />}
            />
            <Route path="progress" element={<Progress />} />
            <Route path="profile" element={<Profile />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    );
  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="app-root">{content}</div>
        <ControllerKeyboard />
      </ToastProvider>
    </ErrorBoundary>
  );
}
export default App;
