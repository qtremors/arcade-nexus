import { configureGameRuntime } from "./shared/runtime/gameRuntime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./shared/styles/theme.css";
import "./app/shell/console.css";
import "./features/catalog/catalog.css";
import "./features/settings/settings.css";
import "./shared/ui/dialogs.css";
import "./features/progress/history.css";
import "./features/session/components/session.css";
import App from "./app/App.tsx";
import { ErrorBoundary } from "./shared/ui/ErrorBoundary";

configureGameRuntime();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
