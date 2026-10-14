import { beforeEach, expect, it } from "vitest";
import { bindingProblem, normalizeBindings } from "../services/controls";
import { useSettingsStore } from "../stores/settingsStore";

beforeEach(() => useSettingsStore.getState().reset());
it("rejects conflicts with default aliases, custom mappings and the pause key", () => {
  const store = useSettingsStore.getState();
  expect(store.setBinding("up", "KeyA")).toContain("left");
  expect(store.setBinding("up", "KeyP")).toContain("Pause");
  expect(store.setBinding("up", "KeyZ")).toContain("Undo");
  expect(store.setBinding("up", "KeyJ")).toBeNull();
  expect(store.setBinding("down", "KeyJ")).toContain("up");
  expect(useSettingsStore.getState().bindings).toEqual({ up: "KeyJ" });
  expect(bindingProblem("action", "Enter", {})).toBeNull();
});
it("cleans conflicting stored bindings while retaining valid swaps", () => {
  expect(
    normalizeBindings({
      up: "KeyJ",
      down: "KeyJ",
      right: "KeyP",
      invalid: "KeyZ",
    }),
  ).toEqual({});
  expect(normalizeBindings({ up: "KeyA", left: "KeyW" })).toEqual({
    up: "KeyA",
    left: "KeyW",
  });
  expect(normalizeBindings({ up: "KeyA", down: "KeyW" })).toEqual({});
  expect(normalizeBindings(null)).toEqual({});
});
