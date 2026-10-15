import { beforeEach, expect, it, vi } from "vitest";
import { progressApi } from "../api/client";
import { clearRecovery, storeRecovery } from "../services/recovery";
import type { SaveEnvelope } from "../services/saves";

function deferred() {
  let resolve!: (value: { saved: boolean }) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<{ saved: boolean }>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const snapshot = (score: number, session = "first"): SaveEnvelope => ({
  format: 2,
  game: "snake",
  difficulty: "normal",
  mode: "classic",
  rules_version: 1,
  config: {},
  state: { score },
  score,
  session_id: session,
  saved_at: new Date().toISOString(),
});
let profileId = 30000;
beforeEach(() => {
  profileId++;
  localStorage.clear();
  vi.spyOn(progressApi, "saveRecovery").mockResolvedValue({ saved: true });
  vi.spyOn(progressApi, "deleteRecovery").mockResolvedValue({ deleted: true });
});

it("coalesces a slow server's snapshots while retaining the newest local board", async () => {
  const gate = deferred();
  const write = vi
    .mocked(progressApi.saveRecovery)
    .mockImplementationOnce(() => gate.promise);
  storeRecovery(profileId, snapshot(0));
  for (let score = 1; score <= 100; score++)
    storeRecovery(profileId, snapshot(score));
  expect(write).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse(localStorage.getItem(`nexus-recovery-v2:${profileId}:snake`)!),
  ).toMatchObject({ score: 100 });
  gate.resolve({ saved: true });
  await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
  expect(write).toHaveBeenLastCalledWith(
    "snake",
    expect.objectContaining({ score: 100 }),
    profileId,
  );
});

it("keeps players independent and sends the newest snapshot after a failed request", async () => {
  const gate = deferred();
  const write = vi
    .mocked(progressApi.saveRecovery)
    .mockImplementationOnce(() => gate.promise);
  storeRecovery(profileId, snapshot(1));
  storeRecovery(profileId, snapshot(2));
  storeRecovery(profileId + 1000, snapshot(10));
  expect(write).toHaveBeenCalledTimes(2);
  gate.reject(new Error("offline"));
  await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(3));
  expect(write).toHaveBeenLastCalledWith(
    "snake",
    expect.objectContaining({ score: 2 }),
    profileId,
  );
  storeRecovery(profileId, snapshot(3));
  await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(4));
});

it("discards a cleared pending board and keeps deletion before a new run's write", async () => {
  const gate = deferred();
  const operations: string[] = [];
  vi.mocked(progressApi.saveRecovery).mockImplementation((_slug, value) => {
    operations.push(`save:${value.session_id}:${value.score}`);
    return operations.length === 1
      ? gate.promise
      : Promise.resolve({ saved: true });
  });
  vi.mocked(progressApi.deleteRecovery).mockImplementation(
    async (_slug, _id, session) => {
      operations.push(`delete:${session}`);
      return { deleted: true };
    },
  );
  storeRecovery(profileId, snapshot(1));
  storeRecovery(profileId, snapshot(2));
  clearRecovery(profileId, "snake", "first");
  storeRecovery(profileId, snapshot(3, "second"));
  gate.resolve({ saved: true });
  await vi.waitFor(() => expect(operations).toHaveLength(3));
  expect(operations).toEqual(["save:first:1", "delete:first", "save:second:3"]);
  expect(
    JSON.parse(localStorage.getItem(`nexus-recovery-v2:${profileId}:snake`)!),
  ).toMatchObject({ session_id: "second" });
});

it("does not discard a newer run when an older session's completion clears recovery", async () => {
  const gate = deferred();
  const write = vi
    .mocked(progressApi.saveRecovery)
    .mockImplementationOnce(() => gate.promise);
  storeRecovery(profileId, snapshot(1));
  storeRecovery(profileId, snapshot(2, "second"));
  clearRecovery(profileId, "snake", "first");
  gate.resolve({ saved: true });
  await vi.waitFor(() =>
    expect(progressApi.deleteRecovery).toHaveBeenCalledWith(
      "snake",
      profileId,
      "first",
    ),
  );
  expect(write).toHaveBeenLastCalledWith(
    "snake",
    expect.objectContaining({ session_id: "second" }),
    profileId,
  );
  expect(
    JSON.parse(localStorage.getItem(`nexus-recovery-v2:${profileId}:snake`)!),
  ).toMatchObject({ session_id: "second" });
});
