import { z } from "zod";
import { dataApi } from "../api/client";
import { completionSchema, enqueueCompletion } from "./sessionQueue";
import { useSettingsStore } from "../stores/settingsStore";
const allowed = (key: string) =>
  key === "nexus-preferences" ||
  key.startsWith("nexus-result-v1:") ||
  key.startsWith("nexus-recovery-v2:");
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportBackup() {
  const browser: Record<string, string> = {};
  for (const key of Object.keys(localStorage))
    if (allowed(key)) browser[key] = localStorage.getItem(key)!;
  downloadJson(
    {
      format: "arcade-nexus-backup-1",
      database: await dataApi.export(),
      browser,
    },
    `arcade-nexus-${new Date().toISOString().slice(0, 10)}.json`,
  );
}
export async function restoreBackup(file: File) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Backups must be smaller than 20 MB.");
  const parsed = z
    .object({
      format: z.literal("arcade-nexus-backup-1"),
      database: z.unknown(),
      browser: z.record(z.string(), z.string()).default({}),
    })
    .parse(JSON.parse(await file.text()));
  const result = await dataApi.restore(parsed.database);
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
        const profileId = result.profile_map[String(item.profileId)];
        if (profileId)
          enqueueCompletion({
            ...item,
            profileId,
            sessionId:
              result.session_map[item.sessionId] ?? crypto.randomUUID(),
            attempts: 0,
            retryAt: 0,
            blocked: false,
            error: undefined,
          });
      } else {
        const [, oldId, slug] = key.split(":");
        const id = result.profile_map[oldId];
        if (id) localStorage.setItem(`nexus-recovery-v2:${id}:${slug}`, value);
      }
    } catch {
      skipped++;
    }
  }
  return { ...result, skipped };
}
