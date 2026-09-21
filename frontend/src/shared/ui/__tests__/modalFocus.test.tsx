import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import type { ReactNode } from "react";
import { useModalFocus } from "../useModalFocus";
function Modal({
  children,
  label = "Dialog",
}: {
  children?: ReactNode;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, true);
  return (
    <div ref={ref} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(
    function (this: HTMLElement) {
      // Chromium can retain layout boxes for controls inside closed details.
      const hidden = this.closest("[hidden]") || this.style.display === "none";
      return (hidden
        ? []
        : [{ width: 100, height: 20 }]) as unknown as DOMRectList;
    },
  );
});
it("skips disabled/hidden controls and controls inside closed details", () => {
  render(
    <Modal>
      <button hidden data-primary="true">
        Hidden primary
      </button>
      <input disabled aria-label="Disabled" />
      <input type="hidden" />
      <fieldset disabled>
        <button>Disabled by fieldset</button>
      </fieldset>
      <button style={{ visibility: "hidden" }}>Invisible</button>
      <button tabIndex={-1}>Programmatic only</button>
      <button>First</button>
      <details>
        <summary tabIndex={0}>Controls</summary>
        <button>Closed detail</button>
        <summary tabIndex={0}>Hidden second summary</summary>
        <details>
          <summary tabIndex={0}>Hidden nested summary</summary>
          <button>Hidden nested button</button>
        </details>
      </details>
      <button>Last</button>
    </Modal>,
  );
  const first = screen.getByRole("button", { name: "First" }),
    last = screen.getByRole("button", { name: "Last" });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Tab" });
  expect(screen.getByText("Controls")).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: "Tab" });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(first).toHaveFocus();
});
it("recaptures escaped focus in either direction and restores the original control", () => {
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  const view = render(
    <Modal>
      <button>First</button>
      <button>Last</button>
    </Modal>,
  );
  outside.focus();
  fireEvent.keyDown(outside, { key: "Tab", shiftKey: true });
  expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
  outside.focus();
  fireEvent.keyDown(outside, { key: "Tab" });
  expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  view.unmount();
  expect(outside).toHaveFocus();
  outside.remove();
});
it("keeps an empty loading dialog focusable", () => {
  render(
    <Modal>
      <p>Loading</p>
    </Modal>,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(dialog).toHaveFocus();
});
it("lets the innermost custom modal and native confirmations own keyboard focus", () => {
  render(
    <Modal label="Outer">
      <button>Outer control</button>
      <Modal label="Inner">
        <button>Inner control</button>
      </Modal>
    </Modal>,
  );
  const inner = screen.getByRole("button", { name: "Inner control" });
  expect(inner).toHaveFocus();
  fireEvent.keyDown(inner, { key: "Tab" });
  expect(inner).toHaveFocus();
  const native = document.createElement("dialog"),
    button = document.createElement("button");
  native.open = true;
  native.append(button);
  document.body.append(native);
  button.focus();
  expect(fireEvent.keyDown(button, { key: "Tab" })).toBe(true);
  expect(button).toHaveFocus();
  native.remove();
});
