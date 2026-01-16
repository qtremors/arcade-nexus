import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Store } from './pages/Store';
import { Library } from './pages/Library';
import { Profile } from './pages/Profile';
import { Achievements } from './pages/Achievements';
import { Settings } from './pages/Settings';
import { GamePlayer } from './pages/GamePlayer';
import { Layout } from './components/Layout';
import { BootSequence } from './components/arcus/BootSequence';
import { ProfileSetup } from './components/arcus/ProfileSetup';
import { ProfileSelector } from './components/arcus/ProfileSelector';
import { ToastProvider } from './components/Toast';
import { FocusProvider } from './contexts/FocusContext';
import { useProfileStore } from './stores/profileStore';
import { Server, RefreshCw } from 'lucide-react';
import './App.css';

type AppState = 'initializing' | 'booting' | 'profile-select' | 'profile-setup' | 'offline' | 'ready';

// Track if this is the first boot in this browser session
const SESSION_KEY = 'arcade_nexus_session_booted';

function App() {
  const [appState, setAppState] = useState<AppState>('initializing');

  const { initialize, activeProfile, profiles, isInitialized: profileInitialized, error } = useProfileStore();

  // Check if we've already booted in this session
  const hasBootedThisSession = sessionStorage.getItem(SESSION_KEY) === 'true';

  // Periodic health check to detect offline/online status
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/health`);
        if (res.ok && appState === 'offline') {
          setAppState('initializing');
          initialize(); // Retry init if we were offline
        }
      } catch (e) {
        if (appState !== 'offline' && profileInitialized) {
          // Only switch to offline if we definitely can't reach backend
          // strict check might be annoying during dev reloads, so we'll rely on profiles failure for now
          // but this structure is here for future robust handling
        }
      }
    };

    // Initial check on mount
    checkHealth();

    // Poll every 10s if offline
    let interval: number | undefined;
    if (appState === 'offline') {
      interval = window.setInterval(checkHealth, 5000);
    }

    return () => clearInterval(interval);
  }, [appState, initialize, profileInitialized]);

  // Initialize profile store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Determine app state based on profile
  useEffect(() => {
    if (!profileInitialized) return;

    // Check if backend is offline (error and no profiles)
    if (error && profiles.length === 0) {
      if (appState !== 'offline') setAppState('offline');
      return;
    }

    // If we've already booted this session and have an active profile, go straight to ready
    if (hasBootedThisSession && activeProfile) {
      if (appState !== 'ready') setAppState('ready');
      return;
    }

    // First boot this session
    if (!hasBootedThisSession) {
      // Show boot animation first
      if (appState !== 'booting') setAppState('booting');
      return;
    }

    // Booted before but no active profile - show selector or setup
    if (profiles.length === 0) {
      if (appState !== 'profile-setup') setAppState('profile-setup');
    } else {
      if (appState !== 'profile-select') setAppState('profile-select');
    }
  }, [profileInitialized, activeProfile, profiles.length, hasBootedThisSession, error, appState]);

  const handleRetry = () => {
    setAppState('initializing');
    initialize();
  };

  const handleBootComplete = () => {
    // Mark as booted for this session
    sessionStorage.setItem(SESSION_KEY, 'true');

    if (activeProfile) {
      setAppState('ready');
    } else if (profiles.length === 0) {
      setAppState('profile-setup');
    } else {
      setAppState('profile-select');
    }
  };

  const handleProfileSelected = () => {
    setAppState('ready');
  };

  const handleCreateNew = () => {
    setAppState('profile-setup');
  };

  const handleProfileComplete = () => {
    setAppState('ready');
  };

  // Initializing
  if (appState === 'initializing') {
    return (
      <div className="app-root bg-[#121214] flex items-center justify-center">
        <div className="text-zinc-500 font-mono text-sm">INITIALIZING...</div>
      </div>
    );
  }

  // Backend offline
  if (appState === 'offline') {
    return (
      <div className="app-root bg-zinc-900 flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-900/20 flex items-center justify-center">
            <Server className="text-red-400" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Backend Offline</h1>
          <p className="text-zinc-500 mb-6">
            Cannot connect to the Arcade Nexus backend server.
            Please start the backend and try again.
          </p>
          <div className="text-xs font-mono text-zinc-600 mb-6 p-4 bg-black rounded-lg text-left">
            <p className="mb-2">Run this command:</p>
            <code className="text-cyan-400">cd backend && uv run uvicorn app.main:app --reload</code>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 mx-auto px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={18} />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Boot sequence
  if (appState === 'booting') {
    return (
      <div className="app-root">
        <BootSequence onComplete={handleBootComplete} />
      </div>
    );
  }

  // Profile selector
  if (appState === 'profile-select') {
    return (
      <div className="app-root">
        <ProfileSelector onSelect={handleProfileSelected} onCreateNew={handleCreateNew} />
      </div>
    );
  }

  // Profile setup
  if (appState === 'profile-setup') {
    return (
      <div className="app-root">
        <ProfileSetup onComplete={handleProfileComplete} />
      </div>
    );
  }

  // Main app
  return (
    <div className="app-root">
      <ToastProvider>
        <BrowserRouter>
          <FocusProvider>
            <Routes>
              <Route path="/play/:slug" element={<GamePlayer />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/home" replace />} />
                <Route path="home" element={<Dashboard />} />
                <Route path="store" element={<Store />} />
                <Route path="library" element={<Library />} />
                <Route path="profile" element={<Profile />} />
                <Route path="achievements" element={<Achievements />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </FocusProvider>
        </BrowserRouter>
      </ToastProvider>
    </div>
  );
}

export default App;
