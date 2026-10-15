import api from "./transport";
import type { ApiSchemas } from "../contracts/api.generated";
import type { BackupPreview, SnapshotInfo, BackupStatus } from "./types";
export const dataApi = {
  export: async (): Promise<unknown> => (await api.get("/data/export")).data,
  preview: async (data: unknown) =>
    (await api.post<BackupPreview>("/data/preview", data, { timeout: 60000 }))
      .data,
  backups: async () => (await api.get<BackupStatus>("/data/backups")).data,
  createSnapshot: async () =>
    (await api.post<SnapshotInfo>("/data/backups", {}, { timeout: 60000 }))
      .data,
  previewSnapshot: async (name: string) =>
    (
      await api.post<BackupPreview>(
        `/data/backups/${encodeURIComponent(name)}/preview`,
        {},
        { timeout: 60000 },
      )
    ).data,
  restoreSnapshot: async (name: string) =>
    (
      await api.post<ApiSchemas["BackupImport"]>(
        `/data/backups/${encodeURIComponent(name)}/restore`,
        {},
        { timeout: 60000 },
      )
    ).data,
  restore: async (data: unknown) =>
    (
      await api.post<ApiSchemas["BackupImport"]>("/data/import", data, {
        timeout: 60000,
      })
    ).data,
};
