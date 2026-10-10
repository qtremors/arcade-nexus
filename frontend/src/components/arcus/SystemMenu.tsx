import { useRef } from "react";
import { useModalFocus } from "../../hooks/useModalFocus";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ShoppingBag,
  Library,
  User,
  Trophy,
  Home,
  X,
  Settings as SettingsIcon,
} from "lucide-react";
import { useProfileStore } from "../../stores/profileStore";
import { AudioManager } from "../../sdk/AudioManager";
import { useGamepad } from "../../hooks/useGamepad";

interface SystemMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SystemMenu({ isOpen, onClose }: SystemMenuProps) {
  const panel = useRef<HTMLDivElement>(null);
  useModalFocus(panel, isOpen);
  const navigate = useNavigate();
  const location = useLocation();
  const activeProfile = useProfileStore((state) => state.activeProfile);

  const menuItems = [
    { label: "Home", path: "/home", icon: Home },
    { label: "Store", path: "/store", icon: ShoppingBag },
    { label: "Library", path: "/library", icon: Library },
    { label: "Achievements", path: "/achievements", icon: Trophy },
    { label: "Profile", path: "/profile", icon: User },
  ];

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  useGamepad((button) => {
    if (!isOpen) return;
    if (button === "B") onClose();
    if (button === "A") (document.activeElement as HTMLElement | null)?.click();
    if (["Up", "Down", "Left", "Right"].includes(button)) {
      const targets = Array.from(
        panel.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) ?? [],
      );
      const index = targets.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      targets[
        (index +
          (button === "Up" || button === "Left" ? -1 : 1) +
          targets.length) %
          targets.length
      ]?.focus();
    }
  });

  if (!isOpen) return null;
  return (
    <div className="system-backdrop" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="System menu"
        className="system-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="system-panel-heading">
          <span className="eyebrow">YOUR CONSOLE</span>
          <button
            className="system-close"
            aria-label="Close system menu"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="system-player">
          <span>{activeProfile?.avatar ?? "🎮"}</span>
          <div>
            <h2>{activeProfile?.username ?? "Player"}</h2>
            <p>Make yourself at home.</p>
          </div>
        </div>
        <div className="system-links">
          {menuItems.map(({ label, path, icon: Icon }) => (
            <button
              key={path}
              aria-current={location.pathname === path ? "page" : undefined}
              onClick={() => {
                AudioManager.getInstance().playSelect();
                handleNav(path);
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              <span className="system-link-arrow">↗</span>
            </button>
          ))}
        </div>
        <div className="system-panel-footer">
          <button onClick={() => handleNav("/settings")}>
            <SettingsIcon size={19} />
            Settings
          </button>
          <p>
            <kbd>Esc</kbd> Close menu · Local console
          </p>
        </div>
      </div>
    </div>
  );
}
