import { z } from "zod";
import { dataApi } from "../../api/client";
import {
  completionSchema,
  enqueueCompletion,
  pendingResults,
} from "./sessionQueue";
import { useSettingsStore } from "../state/settingsStore";
import { recoverySnapshots } from "./recovery";
import { readSave } from "./saves";
import { downloadJson } from "../files/download";
export { downloadJson } from "../files/download";
const allowed = (key: string) =>
  key === "nexus-preferences" ||
  key.startsWith("nexus-result-v1:") ||
  key.startsWith("nexus-recovery-v2:");
export async function createBackup() {
  const browser: Record<string, string> = {};
  try {
    for (const key of Object.keys(localStorage))
      if (allowed(key)) {
        const value = localStorage.getItem(key);
        if (value !== null) browser[key] = value;
      }
  } catch {
    /* In-memory results and server data remain exportable without browser storage. */
  }
  for (const item of pendingResults())
    browser[`nexus-result-v1:${item.sessionId}`] = JSON.stringify(item);
  for (const [key, value] of recoverySnapshots()) {
    let stored;
    try {
      stored = JSON.parse(browser[key] ?? "null");
    } catch {
      /* Prefer the usable snapshot. */
    }
    if (
      !stored ||
      typeof stored.saved_at !== "string" ||
      (value.saved_at ?? "") >= stored.saved_at
    )
      browser[key] = JSON.stringify(value);
  }
  browser["nexus-preferences"] = JSON.stringify({
    state: useSettingsStore.getState(),
    version: 0,
  });
  return {
    format: "arcade-nexus-backup-1",
    database: await dataApi.export(),
    browser,
  };
}
export async function exportBackup() {
  downloadJson(
    await createBackup(),
    `arcade-nexus-${new Date().toISOString().slice(0, 10)}.json`,
  );
}
const backupSchema = z.object({
  format: z.literal("arcade-nexus-backup-1"),
  database: z.unknown(),
  browser: z.record(z.string(), z.string()).default({}),
});
const prepared = new WeakMap<File, z.infer<typeof backupSchema>>();
async function readBackup(file: File) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Backups must be smaller than 20 MB.");
  const cached = prepared.get(file);
  if (cached) return cached;
  const parsed = backupSchema.parse(JSON.parse(await file.text()));
  prepared.set(file, parsed);
  return parsed;
}
export async function previewBackup(file: File) {
  const parsed = await readBackup(file);
  const result = await dataApi.preview(parsed.database);
  let queued = 0,
    browserRecoveries = 0,
    invalid = 0,
    preferences = false;
  for (const [key, value] of Object.entries(parsed.browser)) {
    if (!allowed(key)) continue;
    try {
      if (key === "nexus-preferences") {
        z.object({ state: z.record(z.string(), z.unknown()) }).parse(
          JSON.parse(value),
        );
        preferences = true;
      } else if (key.startsWith("nexus-result-v1:")) {
        const item = completionSchema.parse(JSON.parse(value));
        if (
          key !== `nexus-result-v1:${item.sessionId}` ||
          !result.profile_ids.includes(item.profileId)
        )
          throw new Error("Unmapped result");
        queued++;
      } else {
        const match =
          /^nexus-recovery-v2:([1-9]\d*):([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(key);
        if (!match || !result.profile_ids.includes(Number(match[1])))
          throw new Error("Unmapped recovery");
        readSave(JSON.parse(value), match[2]);
        browserRecoveries++;
      }
    } catch {
      invalid++;
    }
  }
  return { ...result, queued, browserRecoveries, invalid, preferences };
}
export async function restoreBackup(file: File) {
  const parsed = await readBackup(file);
  const result = await dataApi.restore(parsed.database);
  const sessionMap = new Map(Object.entries(result.session_map));
  const remapSession = (id: string) => {
    if (!sessionMap.has(id)) sessionMap.set(id, crypto.randomUUID());
    return sessionMap.get(id)!;
  };
  let skipped = 0;
  for (const [key, value] of Object.entries(parsed.browser)) {
    if (!allowed(key)) continue;
    try {
      if (key === "nexus-preferences") {
        z.object({ state: z.record(z.string(), z.unknown()) }).parse(
          JSON.parse(value),
        );
        localStorage.setItem(key, value);
        await useSettingsStore.persist.rehydrate();
      } else if (key.startsWith("nexus-result-v1:")) {
        const item = completionSchema.parse(JSON.parse(value));
        if (key !== `nexus-result-v1:${item.sessionId}`)
          throw new Error("Mismatched queued session identity");
        const profileId = result.profile_map[String(item.profileId)];
        if (!profileId)
          throw new Error("Player was not included in this backup");
        if (
          !enqueueCompletion({
            ...item,
            profileId,
            sessionId: remapSession(item.sessionId),
            attempts: 0,
            retryAt: 0,
            blocked: false,
            error: undefined,
          })
        )
          skipped++;
      } else {
        const match =
          /^nexus-recovery-v2:([1-9]\d*):([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(key);
        if (!match) throw new Error("Invalid recovery identity");
        const [, oldId, slug] = match;
        const id = result.profile_map[oldId];
        if (!id) throw new Error("Player was not included in this backup");
        const save = readSave(JSON.parse(value), slug);
        if (save.session_id && z.uuid().safeParse(save.session_id).success)
          save.session_id = remapSession(save.session_id);
        localStorage.setItem(
          `nexus-recovery-v2:${id}:${slug}`,
          JSON.stringify(save),
        );
      }
    } catch {
      skipped++;
    }
  }
  return { ...result, skipped };
}
