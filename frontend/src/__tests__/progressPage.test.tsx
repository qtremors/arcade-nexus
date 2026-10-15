import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Progress } from "../pages/Progress";
import { progressApi } from "../api/client";
import type { ModeRecord } from "../api/client";

function deferred() {
  let resolve!: (value: ModeRecord[]) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<ModeRecord[]>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const record: ModeRecord = {
  game_slug: "snake",
  profile_id: 1,
  player: "Current player",
  mode: "classic",
  difficulty: "normal",
  rules_version: 1,
  high_score: 100,
  best_time_ms: null,
};
const open = () =>
  render(
    <MemoryRouter>
      <Progress />
    </MemoryRouter>,
  );

it("distinguishes loading, empty results and failed retries", async () => {
  const initial = deferred(),
    household = deferred();
  vi.spyOn(progressApi, "records")
    .mockReturnValueOnce(initial.promise)
    .mockReturnValueOnce(household.promise)
    .mockResolvedValue([record]);
  open();
  expect(screen.getByRole("status")).toHaveTextContent("Loading records");
  expect(screen.queryByText(/No records yet/)).toBeNull();
  await act(async () => initial.resolve([]));
  expect(screen.getByText(/No records yet/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Household records" }));
  expect(screen.getByRole("status")).toHaveTextContent("Loading records");
  await act(async () => household.reject(new Error("Server unavailable")));
  expect(screen.getByRole("alert")).toHaveTextContent("Server unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry records" }));
  expect(screen.getByRole("status")).toHaveTextContent("Loading records");
  expect(await screen.findByText("Current player")).toBeVisible();
});

it("aborts abandoned views and never displays stale household rows as personal records", async () => {
  const household = deferred(),
    personal = deferred();
  const request = vi
    .spyOn(progressApi, "records")
    .mockResolvedValueOnce([record])
    .mockReturnValueOnce(household.promise)
    .mockReturnValueOnce(personal.promise);
  open();
  await screen.findByText("Current player");
  fireEvent.click(screen.getByRole("button", { name: "Household records" }));
  const signal = request.mock.calls[1][1]!;
  fireEvent.click(screen.getByRole("button", { name: "Your records" }));
  expect(signal.aborted).toBe(true);
  expect(screen.queryByRole("table")).toBeNull();
  await act(async () =>
    household.resolve([{ ...record, player: "Another player" }]),
  );
  expect(screen.queryByText("Another player")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Loading records");
  await act(async () => personal.resolve([{ ...record, high_score: 200 }]));
  expect(screen.getByText("Current player")).toBeVisible();
  expect(screen.getByRole("table")).toHaveTextContent("200 points");
});
