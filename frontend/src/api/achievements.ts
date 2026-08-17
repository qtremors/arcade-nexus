import api, { playerConfig } from "./transport";
import type { ApiSchemas } from "../contracts/api.generated";
export const achievementsApi = {
  summary: async () => {
    const { data } = await api.get<ApiSchemas["AchievementSummary"]>(
      "/achievements/summary",
      playerConfig(),
    );
    return data;
  },
  getAll: async () => {
    const { data } = await api.get<ApiSchemas["AchievementListResponse"]>(
      "/achievements",
      playerConfig(),
    );
    return data;
  },

  getForGame: async (gameSlug: string, profileId?: number) => {
    const { data } = await api.get<ApiSchemas["AchievementListResponse"]>(
      `/achievements/${gameSlug}`,
      playerConfig(profileId),
    );
    return data;
  },

  unlock: async (
    gameSlug: string,
    achievementSlug: string,
    profileId?: number,
  ) => {
    const { data } = await api.post<ApiSchemas["AchievementUnlockResponse"]>(
      "/achievements/unlock",
      {
        game_slug: gameSlug,
        achievement_slug: achievementSlug,
      },
      playerConfig(profileId),
    );
    return data;
  },
};
