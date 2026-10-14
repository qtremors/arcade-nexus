import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { dataApi, progressApi } from "../api/client";
import { createBackup, previewBackup, restoreBackup } from "../services/backup";
import { clearRecovery, storeRecovery } from "../services/recovery";
import {
  enqueueCompletion,
  flushCompletions,
  pendingResults,
} from "../services/sessionQueue";
import { useSettingsStore } from "../stores/settingsStore";
import type { SaveEnvelope } from "../services/saves";

const completion = () => ({
  slug: "snake",
  sessionId: crypto.randomUUID(),
  profileId: 7,
  seconds: 10,
  score: 50,
  difficulty: "normal" as const,
  metrics: {},
});
const recovery = (sessionId: string): SaveEnvelope => ({
  format: 2,
  game: "snake",
  difficulty: "normal",
  mode: "classic",
  rules_version: 1,
  config: {},
  state: { score: 50 },
  score: 50,
  session_id: sessionId,
  saved_at: "2026-10-14T00:00:00.000Z",
});
const file = (browser: Record<string, string>) =>
  ({
    size: 100,
    text: async () =>
      JSON.stringify({
        format: "arcade-nexus-backup-1",
        database: { format: 1, profiles: [] },
        browser,
      }),
  }) as File;
beforeEach(() => {
  localStorage.clear();
  useSettingsStore.getState().reset();
  vi.spyOn(dataApi, "export").mockResolvedValue({ format: 1, profiles: [] });
  vi.spyOn(dataApi, "preview").mockResolvedValue({
    profiles: 1,
    profile_ids: [7],
    names: ["Player"],
    games: 1,
    saves: 1,
    sessions: 2,
    records: 0,
    recoveries: 0,
  });
  vi.spyOn(dataApi, "restore").mockResolvedValue({
    imported: 1,
    profile_map: { "7": 70 },
    session_map: {},
  });
  vi.spyOn(progressApi, "complete").mockResolvedValue({
    high_score: 50,
    is_new_high_score: false,
    awards: [],
  });
  vi.spyOn(progressApi, "saveRecovery").mockResolvedValue({});
  vi.spyOn(progressApi, "deleteRecovery").mockResolvedValue(undefined);
});
afterEach(async () => {
  await flushCompletions(true);
});

it("exports volatile results, recovery and current preferences when browser storage is unavailable", async () => {
  const item = completion();
  useSettingsStore.setState({ volume: 0.7 });
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Blocked");
  });
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("Blocked");
    });
  expect(enqueueCompletion(item)).toBe(false);
  expect(storeRecovery(7, recovery(item.sessionId))).toBe(false);
  const backup = await createBackup();
  expect(
    JSON.parse(backup.browser[`nexus-result-v1:${item.sessionId}`]),
  ).toMatchObject(item);
  expect(JSON.parse(backup.browser["nexus-recovery-v2:7:snake"])).toMatchObject(
    { game: "snake", score: 50 },
  );
  expect(JSON.parse(backup.browser["nexus-preferences"]).state.volume).toBe(
    0.7,
  );
  read.mockRestore();
  write.mockRestore();
  clearRecovery(7, "snake");
  await vi.waitFor(() => expect(progressApi.deleteRecovery).toHaveBeenCalled());
});
it("remaps queued and recovery identities together while preserving the original player's data", async () => {
  const item = completion(),
    original = recovery(item.sessionId);
  localStorage.setItem("nexus-recovery-v2:7:snake", JSON.stringify(original));
  const result = await restoreBackup(
    file({
      "nexus-recovery-v2:7:snake": JSON.stringify(original),
      [`nexus-result-v1:${item.sessionId}`]: JSON.stringify(item),
    }),
  );
  const queued = pendingResults().find((value) => value.profileId === 70)!;
  const restored = JSON.parse(
    localStorage.getItem("nexus-recovery-v2:70:snake")!,
  );
  expect(queued.sessionId).not.toBe(item.sessionId);
  expect(restored.session_id).toBe(queued.sessionId);
  expect(
    JSON.parse(localStorage.getItem("nexus-recovery-v2:7:snake")!),
  ).toEqual(original);
  expect(result.skipped).toBe(0);
});
it("keeps the server's remapped completed-session identity for replay-safe restoration", async () => {
  const item = completion(),
    remapped = crypto.randomUUID();
  vi.mocked(dataApi.restore).mockResolvedValue({
    imported: 1,
    profile_map: { "7": 70 },
    session_map: { [item.sessionId]: remapped },
  });
  await restoreBackup(
    file({ [`nexus-result-v1:${item.sessionId}`]: JSON.stringify(item) }),
  );
  expect(pendingResults()).toContainEqual(
    expect.objectContaining({ profileId: 70, sessionId: remapped }),
  );
});
it("reports mismatched queue keys, missing players and recovery saves from another game", async () => {
  const item = completion(),
    unknown = { ...completion(), profileId: 99 };
  const result = await restoreBackup(
    file({
      [`nexus-result-v1:${crypto.randomUUID()}`]: JSON.stringify(item),
      [`nexus-result-v1:${unknown.sessionId}`]: JSON.stringify(unknown),
      "nexus-recovery-v2:7:snake": JSON.stringify({
        ...recovery(item.sessionId),
        game: "tetris",
      }),
    }),
  );
  expect(result.skipped).toBe(3);
  expect(pendingResults()).toHaveLength(0);
  expect(localStorage.getItem("nexus-recovery-v2:70:snake")).toBeNull();
});
it("reports results that cannot be saved durably while retaining them for retry", async () => {
  const item = completion();
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
  const result = await restoreBackup(
    file({ [`nexus-result-v1:${item.sessionId}`]: JSON.stringify(item) }),
  );
  expect(result.skipped).toBe(1);
  expect(pendingResults()).toContainEqual(
    expect.objectContaining({ profileId: 70, score: 50 }),
  );
  write.mockRestore();
});
it("rejects oversized backup files before parsing or importing", async () => {
  const text = vi.fn();
  await expect(
    restoreBackup({ size: 20 * 1024 * 1024 + 1, text } as unknown as File),
  ).rejects.toThrow("20 MB");
  expect(text).not.toHaveBeenCalled();
  expect(dataApi.restore).not.toHaveBeenCalled();
});
it("previews data and invalid browser entries without restoring or changing preferences", async () => {
  const item = completion();
  const volume = useSettingsStore.getState().volume;
  const preview = await previewBackup(
    file({
      [`nexus-result-v1:${item.sessionId}`]: JSON.stringify(item),
      "nexus-recovery-v2:7:snake": JSON.stringify(recovery(item.sessionId)),
      "nexus-preferences": JSON.stringify({ state: { volume: 0.9 } }),
      "nexus-recovery-v2:999:snake": JSON.stringify(recovery(item.sessionId)),
    }),
  );
  expect(preview).toMatchObject({
    profiles: 1,
    saves: 1,
    sessions: 2,
    queued: 1,
    browserRecoveries: 1,
    invalid: 1,
    preferences: true,
  });
  expect(dataApi.restore).not.toHaveBeenCalled();
  expect(pendingResults()).toHaveLength(0);
  expect(useSettingsStore.getState().volume).toBe(volume);
});
it("restores the same parsed file that was previewed", async () => {
  const backupFile = file({});
  const text = vi.spyOn(backupFile, "text");
  await previewBackup(backupFile);
  await restoreBackup(backupFile);
  expect(text).toHaveBeenCalledTimes(1);
  expect(dataApi.preview).toHaveBeenCalledTimes(1);
  expect(dataApi.restore).toHaveBeenCalledTimes(1);
});

it("keeps preferences usable and exports live values when quota prevents updating an older stored copy", async () => {
  const old = localStorage.getItem("nexus-preferences");
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
  expect(() => useSettingsStore.getState().setVolume(0.8)).not.toThrow();
  expect(useSettingsStore.getState().volume).toBe(0.8);
  expect(localStorage.getItem("nexus-preferences")).toBe(old);
  const backup = await createBackup();
  expect(JSON.parse(backup.browser["nexus-preferences"]).state.volume).toBe(
    0.8,
  );
  write.mockRestore();
});
