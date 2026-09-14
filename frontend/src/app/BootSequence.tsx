import { useState, useEffect } from "react";
import { Gamepad2 } from "lucide-react";
import { AudioManager } from "../sdk/AudioManager";
import { useSettingsStore } from "../shared/state/settingsStore";
interface BootSequenceProps {
  onComplete: () => void;
}
export function BootSequence({ onComplete }: BootSequenceProps) {
  const [visible, setVisible] = useState(false);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  useEffect(() => {
    AudioManager.getInstance().playBoot();
    const reveal = window.setTimeout(() => setVisible(true), 50);
    const complete = window.setTimeout(
      onComplete,
      reducedMotion ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 100
        : 1400,
    );
    return () => {
      clearTimeout(reveal);
      clearTimeout(complete);
    };
  }, [onComplete, reducedMotion]);
  return (
    <div className="console-boot">
      <div className={`boot-identity ${visible ? "visible" : ""}`}>
        <span className="boot-mark">
          <Gamepad2 size={36} />
        </span>
        <h1>ARCADE NEXUS</h1>
        <p>Your own little arcade.</p>
      </div>
      <button onClick={onComplete}>Skip intro</button>
    </div>
  );
}
