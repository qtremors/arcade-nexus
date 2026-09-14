import { useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate, Outlet, Link } from "react-router-dom";
import {
  Home,
  ShoppingBag,
  Library as LibraryIcon,
  Trophy,
  LayoutGrid,
  Gamepad2,
} from "lucide-react";
import { SystemMenu } from "../../features/settings/components/SystemMenu";
import { Background } from "../../shared/ui/Background";
import { useLocalConnection } from "../../shared/network/useLocalConnection";
import { watchVisibleTask } from "../../shared/network/background";
import { isEditing } from "../../sdk/InputManager";
import { useGamepad } from "../../shared/input/useGamepad";
import { useProfileStore } from "../../shared/state/profileStore";
import { moveMenuFocus, activateControl } from "../../sdk/menuNavigation";

interface LayoutProps {
  children?: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { status: backendStatus } = useLocalConnection();
  const location = useLocation();
  const navigate = useNavigate();
  const player = useProfileStore((state) => state.activeProfile);
  const isGaming =
    location.pathname.startsWith("/play") ||
    location.pathname.startsWith("/game/");

  // Live clock state
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    return watchVisibleTask(
      () => setTime(new Date()),
      () => 60000,
    );
  }, []);

  // Keyboard/Gamepad shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        !isGaming &&
        e.key === "Escape" &&
        !e.repeat &&
        !isEditing(e.target) &&
        !document.querySelector('[aria-modal="true"]')
      )
        setMenuOpen((prev) => !prev);
    },
    [isGaming],
  );

  useGamepad((button) => {
    if (isGaming || document.querySelector("dialog[open]")) return;
    if (button === "Start" || button === "Guide" || button === "Back") {
      setMenuOpen((prev) => !prev);
      return;
    }
    if (menuOpen || document.querySelector('[aria-modal="true"]')) return;
    if (button === "LB" || button === "RB") {
      const routes = ["/home", "/games", "/favorites", "/progress"];
      const at = Math.max(0, routes.indexOf(location.pathname));
      navigate(
        routes[
          (at + (button === "RB" ? 1 : -1) + routes.length) % routes.length
        ],
      );
      return;
    }
    if (location.pathname === "/home" && !["Up", "Down"].includes(button))
      return; // The game shelf owns left/right and confirm input.
    const focused = document.activeElement as HTMLElement | null;
    if (button === "A") activateControl();
    if (button === "B") navigate("/home");
    if (["Up", "Down", "Left", "Right"].includes(button)) {
      if (
        focused instanceof HTMLSelectElement &&
        ["Left", "Right"].includes(button)
      ) {
        focused.selectedIndex = Math.max(
          0,
          Math.min(
            focused.options.length - 1,
            focused.selectedIndex + (button === "Right" ? 1 : -1),
          ),
        );
        focused.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      if (
        focused instanceof HTMLInputElement &&
        focused.type === "range" &&
        (button === "Left" || button === "Right")
      ) {
        if (button === "Left") focused.stepDown(5);
        else focused.stepUp(5);
        focused.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (!(
        isEditing(focused) &&
        (button === "Left" || button === "Right")
      ))
        moveMenuFocus(button as "Up" | "Down" | "Left" | "Right");
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="console-shell relative w-full h-screen overflow-hidden bg-[var(--bg-primary)] font-sans select-none text-white">
      <Background />

      {!isGaming && (
        <>
          <a href="#console-content" className="skip-link">
            Skip to content
          </a>
          <header inert={menuOpen} className="console-header">
            <Link
              to="/home"
              className="console-brand"
              aria-label="Arcade Nexus home"
            >
              <span className="brand-mark">
                <Gamepad2 size={24} />
              </span>
              <span>
                ARCADE<span className="brand-secondary">NEXUS</span>
              </span>
            </Link>
            <nav aria-label="Main navigation">
              {[
                { path: "/home", label: "Home", icon: Home },
                { path: "/games", label: "Games", icon: ShoppingBag },
                { path: "/favorites", label: "Favorites", icon: LibraryIcon },
                { path: "/progress", label: "Progress", icon: Trophy },
              ].map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  aria-label={label}
                  aria-current={location.pathname === path ? "page" : undefined}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <div className="console-status">
              <span
                className={`connection-dot ${backendStatus}`}
                title={
                  backendStatus === "online"
                    ? "Local server connected"
                    : backendStatus
                }
              />
              <time>
                {time.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              <Link
                to="/profile"
                className="header-player"
                aria-label="Your player profile"
              >
                <span>{player?.avatar ?? "🎮"}</span>
                <strong>{player?.username ?? "Player"}</strong>
              </Link>
              <button
                aria-label="Open system menu"
                className="system-toggle"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          </header>
        </>
      )}

      {/* Main Interactive Stage */}
      <main
        id="console-content"
        tabIndex={-1}
        inert={menuOpen}
        className={`console-main relative z-10 w-full h-full flex flex-col transition-all duration-700 ease-[var(--ease-out-expo)]
                ${menuOpen ? "opacity-50 pointer-events-none" : "opacity-100"}
                ${isGaming ? "is-gaming" : ""}`}
      >
        {children || <Outlet />}
      </main>

      {/* System Menu */}
      <SystemMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
