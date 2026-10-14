import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../App";
import { profilesApi } from "../api/client";
import { useProfileStore } from "../stores/profileStore";
vi.mock("../components/arcus/BootSequence", () => ({
  BootSequence: () => <div>Booting</div>,
}));
vi.mock("../pages/Dashboard", () => ({
  Dashboard: () => <div>Console ready</div>,
}));
vi.mock("../components/Layout", async () => ({
  Layout: (await import("react-router-dom")).Outlet,
}));
vi.mock("../services/sessionQueue", () => ({
  startCompletionSync: vi.fn(() => () => {}),
}));
beforeEach(() => {
  useProfileStore.setState(useProfileStore.getInitialState());
  sessionStorage.clear();
  sessionStorage.setItem("arcade_nexus_session_booted", "true");
});
it("recovers from a backend outage using Retry Connection", async () => {
  vi.spyOn(profilesApi, "list")
    .mockRejectedValueOnce(new Error("Server offline"))
    .mockResolvedValue({
      profiles: [
        {
          id: 1,
          username: "Player",
          avatar: null,
          is_default: true,
          created_at: "2026-01-01",
          last_login: null,
        },
      ],
      active_id: 1,
    });
  render(<App />);
  expect(await screen.findByText("Console unavailable")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry Connection" }));
  expect(await screen.findByText("Console ready")).toBeVisible();
});
it("shows profile setup for an empty installation", async () => {
  vi.spyOn(profilesApi, "list").mockResolvedValue({
    profiles: [],
    active_id: null,
  });
  render(<App />);
  await waitFor(() =>
    expect(screen.getByText("Create your player")).toBeVisible(),
  );
  expect(screen.getByLabelText("Player name")).toBeVisible();
});
