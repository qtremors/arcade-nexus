import { AudioManager } from "../../sdk/AudioManager";

export const menuButton =
  (busy: boolean) =>
  (label: string, onClick: () => void, disabled = false) => (
    <button
      disabled={busy || disabled}
      onClick={() => {
        AudioManager.getInstance().unlock();
        onClick();
      }}
      data-primary={
        [
          "Start game",
          "Resume",
          "Play again",
          "Continue saved run",
          "Undo last move",
        ].includes(label) || undefined
      }
      className="game-button"
    >
      {label}
    </button>
  );
