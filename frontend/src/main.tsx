import { configureGameRuntime } from "./services/gameRuntime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./theme.css";
import "./console.css";
import "./pages/catalog.css";
import "./pages/settings.css";
import "./components/dialogs.css";
import "./components/history.css";
import "./components/session/session.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";

configureGameRuntime();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
