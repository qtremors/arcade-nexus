import { beforeEach, it, expect, vi } from "vitest";
import {
  profilesApi,
  statsApi,
  setApiProfileId,
  gamesApi,
} from "../api/client";
import { useProfileStore } from "../stores/profileStore";
import { useGamesStore } from "../stores/gamesStore";
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
  useGamesStore.setState(useGamesStore.getInitialState());
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
it("a slow catalog response cannot replace a later search result", async () => {
  let resolve!: (value: { games: []; total: number }) => void;
  vi.spyOn(gamesApi, "list")
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue({ games: [], total: 0 });
  const first = useGamesStore.getState().fetchGames(undefined, "old");
  await useGamesStore.getState().fetchGames(undefined, "new");
  resolve({ games: [], total: 1 });
  await first;
  expect(useGamesStore.getState().isLoading).toBe(false);
});
