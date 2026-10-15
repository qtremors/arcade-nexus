import api, { playerConfig } from "./transport";
import type { ApiSchemas } from "../contracts/api.generated";
import type { CompletionReceipt, ModeRecord, HistoryFilters } from "./types";
import type { SaveEnvelope } from "../contracts/saves";
export const progressApi = {
  complete: async (
    slug: string,
    data: ApiSchemas["CompletionRecord"],
    profileId: number,
  ) =>
    (
      await api.post<CompletionReceipt>(
        `/progress/${slug}/complete`,
        data,
        playerConfig(profileId),
      )
    ).data,
  records: async (household = false, signal?: AbortSignal) =>
    (
      await api.get<ModeRecord[]>("/progress/records", {
        ...playerConfig(),
        params: { household },
        signal,
      })
    ).data,
  history: async (
    skip = 0,
    limit = 25,
    gameId?: number,
    filters: HistoryFilters = {},
  ) =>
    (
      await api.get<ApiSchemas["HistoryResponse"]>("/progress/history", {
        ...playerConfig(),
        params: { skip, limit, game_id: gameId, ...filters },
      })
    ).data,
  historyOptions: async () =>
    (
      await api.get<ApiSchemas["HistoryOptions"]>(
        "/progress/history/options",
        playerConfig(),
      )
    ).data,
  recovery: async (profileId?: number) =>
    (
      await api.get<ApiSchemas["RecoveryResponse"][]>(
        "/progress/recovery",
        playerConfig(profileId),
      )
    ).data,
  saveRecovery: async (slug: string, data: SaveEnvelope, profileId: number) =>
    (
      await api.put<ApiSchemas["SavedResponse"]>(
        `/progress/recovery/${slug}`,
        { data },
        playerConfig(profileId),
      )
    ).data,
  deleteRecovery: async (slug: string, profileId: number, sessionId?: string) =>
    (
      await api.delete<ApiSchemas["DeletedResponse"]>(
        `/progress/recovery/${slug}`,
        {
          ...playerConfig(profileId),
          params: { session_id: sessionId },
        },
      )
    ).data,
};
