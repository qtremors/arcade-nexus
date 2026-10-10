import { useEffect, useId, useRef } from "react";
import { useGamepad } from "../hooks/useGamepad";
export interface ConfirmationRequest {
  title: string;
  message: string;
  confirmText: string;
}
export function Confirmation({
  request,
  finish,
}: {
  request: ConfirmationRequest;
  finish: (answer: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId(),
    messageId = useId();
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useGamepad((button) => {
    if (button === "B") finish(false);
    if (button === "A") (document.activeElement as HTMLElement | null)?.click();
    if (["Up", "Down", "Left", "Right"].includes(button)) {
      const buttons = Array.from(
        ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
      );
      const current = buttons.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      buttons[(current + 1) % buttons.length]?.focus();
    }
  });
  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      className="console-confirmation"
      onCancel={(e) => {
        e.preventDefault();
        finish(false);
      }}
    >
      <div className="game-menu-kicker">ARCADE NEXUS / CONFIRM</div>
      <h2 id={titleId}>{request.title}</h2>
      <p id={messageId}>{request.message}</p>
      <div className="confirmation-actions">
        <button onClick={() => finish(false)}>Cancel</button>
        <button className="confirmation-danger" onClick={() => finish(true)}>
          {request.confirmText}
        </button>
      </div>
    </dialog>
  );
}
