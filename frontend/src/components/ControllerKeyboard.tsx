import { useEffect, useRef, useState } from "react";
import { useGamepad } from "../hooks/useGamepad";
import { activateControl, moveMenuFocus } from "../sdk/menuNavigation";

/** Shared browser text entry, including the first-run screen outside the router. */
export function ControllerKeyboard() {
  const [target, setTarget] = useState<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const open = (event: Event) => {
      const input = (event as CustomEvent<HTMLInputElement>).detail;
      setTarget(input);
      setValue(input.value);
    };
    window.addEventListener("nexus-keyboard", open);
    return () => window.removeEventListener("nexus-keyboard", open);
  }, []);
  useEffect(() => {
    if (target) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [target]);
  const close = () => {
    setTarget(null);
    target?.focus();
  };
  const apply = () => {
    if (target) {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(target, value);
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }
    close();
  };
  useGamepad((button) => {
    const root = target
      ? dialog.current
      : document.querySelector(".player-welcome, .startup-panel");
    if (!root || (!target && document.querySelector("dialog[open]"))) return;
    if (button === "B" && target) {
      close();
      return;
    }
    if (button === "A") {
      activateControl();
      return;
    }
    if (["Up", "Down", "Left", "Right"].includes(button))
      moveMenuFocus(button as "Up" | "Down" | "Left" | "Right", root);
  });
  return (
    <dialog
      ref={dialog}
      className="controller-keyboard"
      aria-label="Controller keyboard"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <h2>Enter text</h2>
      <output aria-live="polite">{value || "Choose letters below"}</output>
      <div className="keyboard-keys">
        {[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].map((letter) => (
          <button
            key={letter}
            onClick={() =>
              setValue((v) =>
                (v + letter).slice(
                  0,
                  target?.maxLength && target.maxLength > 0
                    ? target.maxLength
                    : 100,
                ),
              )
            }
          >
            {letter}
          </button>
        ))}
      </div>
      <div className="keyboard-actions">
        <button
          onClick={() =>
            setValue((v) =>
              (v + " ").slice(
                0,
                target?.maxLength && target.maxLength > 0
                  ? target.maxLength
                  : 100,
              ),
            )
          }
        >
          Space
        </button>
        <button onClick={() => setValue((v) => v.slice(0, -1))}>
          Backspace
        </button>
        <button onClick={close}>Cancel</button>
        <button onClick={apply}>Done</button>
      </div>
    </dialog>
  );
}
