/**
 * Error Boundary Component - Catches React errors gracefully
 */
import { Component, createRef, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  exporting: boolean;
  backupError: string;
}

export class ErrorBoundary extends Component<Props, State> {
  private heading = createRef<HTMLHeadingElement>();
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      exporting: false,
      backupError: "",
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, exporting: false, backupError: "" };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.heading.current?.focus();
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, backupError: "" });
  };
  handleExport = async () => {
    this.setState({ exporting: true, backupError: "" });
    try {
      await (await import("../services/backup")).exportBackup();
    } catch {
      this.setState({
        backupError:
          "The backup could not be exported. Keep this tab open, restart the local console if needed, then try exporting again.",
      });
    } finally {
      this.setState({ exporting: false });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <main className="recovery-screen">
          <h1 ref={this.heading} tabIndex={-1}>
            The console needs to recover
          </h1>
          <p>
            Your saved progress is kept on this computer. You can retry this
            screen or reload the console.
          </p>
          <p>
            Before reloading or returning Home, export a backup to keep any
            results or recovery snapshots still held in this tab.
          </p>
          {this.state.backupError && (
            <p role="alert">{this.state.backupError}</p>
          )}
          <div className="recovery-actions">
            <button
              disabled={this.state.exporting}
              onClick={() => void this.handleExport()}
            >
              {this.state.exporting ? "Exporting backup…" : "Export backup"}
            </button>
            <button disabled={this.state.exporting} onClick={this.handleReset}>
              Try again
            </button>
            <button
              disabled={this.state.exporting}
              onClick={() => window.location.reload()}
            >
              Reload console
            </button>
            <a className="secondary-action" href="/home">
              Return to Home
            </a>
          </div>
          {import.meta.env.DEV && (
            <details>
              <summary>Technical details</summary>
              <pre>{this.state.error?.stack || this.state.error?.message}</pre>
            </details>
          )}
        </main>
      );
    }

    return this.props.children;
  }
}
