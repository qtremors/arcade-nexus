import { afterEach, expect, it, vi } from "vitest";
import { moveMenuFocus } from "../../../sdk/menuNavigation";
afterEach(() => {
  document.body.innerHTML = "";
});
it("skips disabled, hidden, inert and closed-details controls even if the browser reports their layout boxes", () => {
  document.body.innerHTML = `<main><button id="start">Start</button><button disabled>Disabled</button><button hidden>Hidden</button><div aria-hidden="true"><button>Aria hidden</button></div><button style="visibility:hidden">Invisible</button><div inert><button>Inert</button></div><details><summary>Options</summary><button>Closed option</button></details><button id="last">Last</button></main>`;
  const controls = [
    ...document.querySelectorAll<HTMLElement>("button, summary"),
  ];
  controls.forEach((control, i) => {
    const rect = {
      x: 0,
      y: i * 40,
      top: i * 40,
      bottom: i * 40 + 30,
      left: 0,
      right: 100,
      width: 100,
      height: 30,
      toJSON: () => ({}),
    };
    vi.spyOn(control, "getBoundingClientRect").mockReturnValue(rect);
    vi.spyOn(control, "getClientRects").mockReturnValue([
      rect,
    ] as unknown as DOMRectList);
    control.scrollIntoView = vi.fn();
  });
  document.getElementById("start")!.focus();
  moveMenuFocus("Down");
  expect(document.activeElement?.tagName).toBe("SUMMARY");
  moveMenuFocus("Down");
  expect(document.activeElement?.id).toBe("last");
  document.querySelector("details")!.open = true;
  moveMenuFocus("Up");
  expect(document.activeElement?.textContent).toBe("Closed option");
});
