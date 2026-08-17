import api, { playerConfig } from "./transport";
import type { ApiSchemas } from "../contracts/api.generated";
import type { SaveData } from "./types";
export const savesApi = {
  list: async (gameSlug: string, profileId?: number) => {
    const { data } = await api.get<ApiSchemas["SaveListResponse"]>(
      `/saves/${gameSlug}`,
      playerConfig(profileId),
    );
    return data;
  },

  create: async (
    gameSlug: string,
    slot: number,
    saveData: Record<string, unknown>,
    name?: string,
    profileId?: number,
  ) => {
    const { data } = await api.post<SaveData>(
      `/saves/${gameSlug}`,
      {
        slot,
        name,
        data: saveData,
      },
      playerConfig(profileId),
    );
    return data;
  },

  delete: async (gameSlug: string, slot: number, profileId?: number) => {
    await api.delete(`/saves/${gameSlug}/${slot}`, playerConfig(profileId));
  },
};
