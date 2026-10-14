import { beforeEach, it, expect, vi } from "vitest";
import { profilesApi, statsApi, setApiProfileId } from "../api/client";
import { useProfileStore } from "../stores/profileStore";
import type { OverallStats, Profile } from "../api/client";
const player = (id: number): Profile => ({
  id,
  username: `Player ${id}`,
  avatar: null,
  is_default: true,
  created_at: "2026-01-01T00:00:00Z",
  last_login: null,
});
const stats: OverallStats = {
  total_playtime_seconds: 100,
  total_games_played: 1,
  total_sessions: 5,
  games: [],
};
beforeEach(() => {
  sessionStorage.clear();
  useProfileStore.setState(useProfileStore.getInitialState());
  setApiProfileId(null);
});
it("failed initialization can be retried", async () => {
  vi.spyOn(profilesApi, "list")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ profiles: [player(1)], active_id: 1 });
  await useProfileStore.getState().initialize();
  expect(useProfileStore.getState().isInitialized).toBe(false);
  await useProfileStore.getState().initialize();
  expect(useProfileStore.getState().activeProfile?.id).toBe(1);
});
it("coalesces profile initialization requests", async () => {
  const list = vi
    .spyOn(profilesApi, "list")
    .mockResolvedValue({ profiles: [player(1)], active_id: 1 });
  await Promise.all([
    useProfileStore.getState().initialize(),
    useProfileStore.getState().initialize(),
  ]);
  expect(list).toHaveBeenCalledTimes(1);
});
it("profile switches invalidate stats and ignore late responses from the old player", async () => {
  useProfileStore.setState({
    activeProfile: player(1),
    overallStats: stats,
    lastStatsFetch: Date.now(),
  });
  let resolve!: (value: OverallStats) => void;
  vi.spyOn(statsApi, "getOverall").mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  vi.spyOn(profilesApi, "activate").mockResolvedValue(player(2));
  vi.spyOn(profilesApi, "list").mockResolvedValue({
    profiles: [player(1), player(2)],
    active_id: 2,
  });
  const request = useProfileStore.getState().fetchOverallStats(true);
  await useProfileStore.getState().switchProfile(2);
  expect(useProfileStore.getState().overallStats).toBeNull();
  resolve(stats);
  await request;
  expect(useProfileStore.getState().overallStats).toBeNull();
});
it("another tab changing the backend default does not change this tab’s player", async () => {
  useProfileStore.setState({ activeProfile: player(1) });
  vi.spyOn(profilesApi, "list").mockResolvedValue({
    profiles: [player(1), player(2)],
    active_id: 2,
  });
  await useProfileStore.getState().fetchProfiles();
  expect(useProfileStore.getState().activeProfile?.id).toBe(1);
});

it("keeps a newly created player usable when its list refresh fails", async () => {
  vi.spyOn(profilesApi, "create").mockResolvedValue(player(2));
  vi.spyOn(profilesApi, "activate").mockResolvedValue(player(2));
  vi.spyOn(profilesApi, "list").mockRejectedValue(new Error("refresh offline"));
  await useProfileStore.getState().createProfile("Player 2");
  expect(useProfileStore.getState()).toMatchObject({
    activeProfile: player(2),
    profiles: [player(2)],
    isInitialized: true,
    isLoading: false,
  });
});

it("does not reuse an old list request after switching to a newly created player", async () => {
  let resolve!: (value: { profiles: Profile[]; active_id: number }) => void;
  const list = vi
    .spyOn(profilesApi, "list")
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue({ profiles: [player(1), player(2)], active_id: 2 });
  useProfileStore.setState({ activeProfile: player(1), profiles: [player(1)] });
  const oldList = useProfileStore.getState().fetchProfiles();
  vi.spyOn(profilesApi, "create").mockResolvedValue(player(2));
  vi.spyOn(profilesApi, "activate").mockResolvedValue(player(2));
  await useProfileStore.getState().createProfile("Player 2");
  expect(list).toHaveBeenCalledTimes(2);
  resolve({ profiles: [player(1)], active_id: 1 });
  await oldList;
  expect(useProfileStore.getState().activeProfile?.id).toBe(2);
  expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual([1, 2]);
});

it("an older refresh cannot overwrite a saved profile edit", async () => {
  let resolve!: (value: { profiles: Profile[]; active_id: number }) => void;
  useProfileStore.setState({ activeProfile: player(1), profiles: [player(1)] });
  vi.spyOn(profilesApi, "list").mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const request = useProfileStore.getState().fetchProfiles();
  vi.spyOn(profilesApi, "update").mockResolvedValue({
    ...player(1),
    username: "Updated",
  });
  await useProfileStore.getState().updateProfile(1, { username: "Updated" });
  resolve({ profiles: [player(1)], active_id: 1 });
  await request;
  expect(useProfileStore.getState().activeProfile?.username).toBe("Updated");
  expect(useProfileStore.getState().profiles[0].username).toBe("Updated");
  expect(useProfileStore.getState().isLoading).toBe(false);
});

it("the latest selected player wins when activation responses arrive out of order", async () => {
  let resolve!: (value: Profile) => void;
  useProfileStore.setState({
    activeProfile: player(1),
    profiles: [player(1), player(2), player(3)],
  });
  vi.spyOn(profilesApi, "activate")
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue(player(3));
  vi.spyOn(profilesApi, "list").mockResolvedValue({
    profiles: [player(1), player(2), player(3)],
    active_id: 3,
  });
  const older = useProfileStore.getState().switchProfile(2);
  await useProfileStore.getState().switchProfile(3);
  resolve(player(2));
  await older;
  expect(useProfileStore.getState().activeProfile?.id).toBe(3);
  expect(sessionStorage.getItem("nexus-profile")).toBe("3");
});
