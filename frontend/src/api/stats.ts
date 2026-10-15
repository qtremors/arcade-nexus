import api, { playerConfig } from "./transport";
import type { ApiSchemas } from "../contracts/api.generated";
import type { GameStats, GameSession, OverallStats } from "./types";
export const statsApi = {
  getOverall: async (profileId?: number) => {
    const { data } = await api.get<OverallStats>(
      "/stats",
      playerConfig(profileId),
    );
    return data;
  },

  getForGame: async (gameSlug: string, profileId?: number) => {
    const { data } = await api.get<GameStats>(
      `/stats/${gameSlug}`,
      playerConfig(profileId),
    );
    return data;
  },

  startSession: async (
    gameSlug: string,
    sessionId: string,
    profileId?: number,
  ) => {
    const { data } = await api.post<ApiSchemas["SessionStartResponse"]>(
      `/stats/${gameSlug}/start`,
      { session_id: sessionId },
      playerConfig(profileId),
    );
    return data;
  },

  recordSession: async (
    gameSlug: string,
    playtimeSeconds: number,
    score: number,
    difficulty: string,
    sessionId: string,
    profileId?: number,
    metrics: Record<string, unknown> = {},
  ) => {
    const { data } = await api.post<ApiSchemas["SessionRecordResponse"]>(
      `/stats/${gameSlug}/session`,
      {
        playtime_seconds: playtimeSeconds,
        score,
        difficulty,
        session_id: sessionId,
        metrics,
      },
      playerConfig(profileId),
    );
    return data;
  },

  submitScore: async (gameSlug: string, score: number, profileId?: number) => {
    const { data } = await api.post<ApiSchemas["ScoreResponse"]>(
      `/stats/${gameSlug}/score`,
      { score },
      playerConfig(profileId),
    );
    return data;
  },

  getHistory: async (gameId?: number) => {
    const params = gameId ? { game_id: gameId } : {};
    const { data } = await api.get<GameSession[]>("/stats/sessions", {
      ...playerConfig(),
      params,
    });
    return data;
  },
};
