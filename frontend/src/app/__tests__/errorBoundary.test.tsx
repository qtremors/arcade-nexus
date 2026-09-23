import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { ErrorBoundary } from "../../shared/ui/ErrorBoundary";
import { exportBackup } from "../../shared/persistence/backup";
import { useConfirmation } from "../../shared/ui/useConfirmation";
afterEach(() => vi.unstubAllEnvs());
vi.mock("../../shared/persistence/backup", () => ({ exportBackup: vi.fn() }));
let broken = true;
function Content() {
  if (broken) throw new Error("private error detail");
  return <p>Recovered game</p>;
}
beforeEach(() => {
  broken = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(exportBackup).mockResolvedValue(undefined);
});
it("offers backup before reload and can retry without reloading the tab", async () => {
  render(
    <ErrorBoundary>
      <Content />
    </ErrorBoundary>,
  );
  expect(
    screen.getByRole("heading", { name: "The console needs to recover" }),
  ).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Export backup" }));
  await waitFor(() => expect(exportBackup).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled(),
  );
  broken = false;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(screen.getByText("Recovered game")).toBeVisible();
});
it("keeps the recovery controls available when backup export fails", async () => {
  vi.mocked(exportBackup).mockRejectedValueOnce(new Error("offline"));
  render(
    <ErrorBoundary>
      <Content />
    </ErrorBoundary>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Export backup" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Keep this tab open",
  );
  expect(screen.getByRole("button", { name: "Export backup" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Reload console" })).toBeEnabled();
});
it("keeps exception details out of the production recovery screen", () => {
  vi.stubEnv("DEV", false);
  render(
    <ErrorBoundary>
      <Content />
    </ErrorBoundary>,
  );
  expect(screen.queryByText(/private error detail/)).not.toBeInTheDocument();
  expect(screen.queryByText("Technical details")).not.toBeInTheDocument();
});
it("cancels confirmations when navigation interrupts a pending preview", async () => {
  const { result, unmount } = renderHook(() => useConfirmation());
  const ask = result.current.ask;
  let answer!: Promise<boolean>;
  act(() => {
    answer = ask({
      title: "Restore?",
      message: "Preview",
      confirmText: "Restore",
    });
  });
  unmount();
  expect(await answer).toBe(false);
  expect(
    await ask({
      title: "Restore?",
      message: "Late preview",
      confirmText: "Restore",
    }),
  ).toBe(false);
});
