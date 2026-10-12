/**
 * API Client - Axios wrapper for local app (no auth required)
 */
import axios from "axios";
import type { GameMetrics } from "../sdk/GameSDK";
import type { SaveEnvelope } from "../services/saves";
import type { AxiosError } from "axios";

export function apiBaseUrl(value = import.meta.env.VITE_API_URL || ""): string {
  const base = value.replace(/\/+$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}
export const API_BASE_URL = apiBaseUrl();
export const HEALTH_URL = `${API_BASE_URL.slice(0, -4)}/health`;
let selectedProfileId: number | null = null;
export const setApiProfileId = (id: number | null) => {
  selectedProfileId = id;
};
export const getApiProfileId = () => selectedProfileId;
const playerConfig = (profileId = selectedProfileId) => {
  if (profileId === null) throw new Error("Select a profile first");
  return { headers: { "X-Profile-ID": String(profileId) } };
};
export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string | { msg: string }[] }>) => {
    // Extract error message
    const detail = error.response?.data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join("; ")
      : detail || error.message;
    return Promise.reject(new ApiError(message, error.response?.status));
  },
);

// API Types
export interface User {
  id: number;
  username: string;
  avatar: string | null;
  created_at: string;
  last_login: string | null;
}

export interface Game {
  config: Record<string, unknown>;
  id: number;
  slug: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  category: "arcade" | "puzzle" | "action" | "strategy" | "simulation";
  version: string;
  is_active: boolean;
  created_at: string;
}

export interface LibraryEntry {
  id: number;
  game: Game;
  added_at: string;
  last_played: string | null;
}

export interface SaveData {
  id: number;
  game_slug: string;
  slot: number;
  name: string | null;
  data: Record<string, unknown>;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameStats {
  game_slug: string;
  game_title: string;
  total_playtime_seconds: number;
  sessions_count: number;
  high_score: number;
  last_session: string | null;
}

export interface GameSession {
  metrics: Record<string, unknown>;
  session_id: string | null;
  id: number;
  game_slug: string;
  game_title: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  score: number;
  difficulty?: string;
  mode: string;
  rules_version: number;
}

export interface CompletionReceipt {
  high_score: number;
  is_new_high_score: boolean;
  awards: { slug: string; title: string; description: string | null }[];
  medal?: string | null;
}
export interface ModeRecord {
  game_slug: string;
  profile_id: number;
  player: string;
  mode: string;
  difficulty: string;
  rules_version: number;
  high_score: number;
}
export const progressApi = {
  complete: async (
    slug: string,
    data: {
      session_id: string;
      playtime_seconds: number;
      score: number;
      difficulty: string;
      mode: string;
      rules_version: number;
      metrics: GameMetrics;
    },
    profileId: number,
  ) =>
    (
      await api.post<CompletionReceipt>(
        `/progress/${slug}/complete`,
        data,
        playerConfig(profileId),
      )
    ).data,
  records: async (household = false) =>
    (
      await api.get<ModeRecord[]>("/progress/records", {
        ...playerConfig(),
        params: { household },
      })
    ).data,
  history: async (skip = 0, limit = 25, gameId?: number) =>
    (
      await api.get<{ sessions: GameSession[]; total: number }>(
        "/progress/history",
        { ...playerConfig(), params: { skip, limit, game_id: gameId } },
      )
    ).data,
  recovery: async (profileId?: number) =>
    (
      await api.get<
        { game_slug: string; data: SaveEnvelope; updated_at: string }[]
      >("/progress/recovery", playerConfig(profileId))
    ).data,
  saveRecovery: async (slug: string, data: SaveEnvelope, profileId: number) =>
    (
      await api.put(
        `/progress/recovery/${slug}`,
        { data },
        playerConfig(profileId),
      )
    ).data,
  deleteRecovery: async (slug: string, profileId: number, sessionId?: string) =>
    (
      await api.delete(`/progress/recovery/${slug}`, {
        ...playerConfig(profileId),
        params: { session_id: sessionId },
      })
    ).data,
};
export const dataApi = {
  export: async (): Promise<unknown> => (await api.get("/data/export")).data,
  restore: async (data: unknown) =>
    (
      await api.post<{
        imported: number;
        profile_map: Record<string, number>;
        session_map: Record<string, string>;
      }>("/data/import", data, { timeout: 60000 })
    ).data,
};

export interface OverallStats {
  total_playtime_seconds: number;
  total_games_played: number;
  total_sessions: number;
  games: GameStats[];
}

export interface Achievement {
  unlock_condition: Record<string, number> | null;
  id: number;
  game_slug: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface Profile {
  id: number;
  username: string;
  avatar: string | null;
  is_default: boolean;
  created_at: string;
  last_login: string | null;
}

export interface ProfileListResponse {
  profiles: Profile[];
  active_id: number | null;
}

// API Functions

export const profilesApi = {
  list: async () => {
    const { data } = await api.get<ProfileListResponse>("/profiles");
    return data;
  },

  getActive: async () => {
    const { data } = await api.get<Profile | null>("/profiles/active");
    return data;
  },

  create: async (username: string, avatar?: string) => {
    const { data } = await api.post<Profile>("/profiles", { username, avatar });
    return data;
  },

  get: async (id: number) => {
    const { data } = await api.get<Profile>(`/profiles/${id}`);
    return data;
  },

  update: async (
    id: number,
    updates: { username?: string; avatar?: string },
  ) => {
    const { data } = await api.put<Profile>(`/profiles/${id}`, updates);
    return data;
  },

  activate: async (id: number) => {
    const { data } = await api.post<Profile>(`/profiles/${id}/activate`);
    return data;
  },

  delete: async (id: number) => {
    await api.delete(`/profiles/${id}`);
  },
};

export const gamesApi = {
  list: async (category?: string, search?: string) => {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (search) params.search = search;

    const { data } = await api.get<{ games: Game[]; total: number }>("/games", {
      params,
    });
    return data;
  },

  get: async (slug: string) => {
    const { data } = await api.get<Game>(`/games/${slug}`);
    return data;
  },

  getCategories: async () => {
    const { data } =
      await api.get<{ value: string; label: string }[]>("/games/categories");
    return data;
  },
};

export const libraryApi = {
  list: async () => {
    const { data } = await api.get<LibraryEntry[]>("/library", playerConfig());
    return data;
  },

  add: async (gameId: number) => {
    const { data } = await api.post<{ message: string; entry: LibraryEntry }>(
      `/library/${gameId}`,
      undefined,
      playerConfig(),
    );
    return data;
  },

  remove: async (gameId: number) => {
    await api.delete(`/library/${gameId}`, playerConfig());
  },
};

export const savesApi = {
  list: async (gameSlug: string, profileId?: number) => {
    const { data } = await api.get<{ saves: SaveData[]; total: number }>(
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
    const { data } = await api.post<{ session_id: string; profile_id: number }>(
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
    const { data } = await api.post(
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
    const { data } = await api.post<{
      is_new_high_score: boolean;
      high_score: number;
    }>(`/stats/${gameSlug}/score`, { score }, playerConfig(profileId));
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

export const achievementsApi = {
  getAll: async () => {
    const { data } = await api.get<{
      achievements: Achievement[];
      total: number;
      unlocked_count: number;
    }>("/achievements", playerConfig());
    return data;
  },

  getForGame: async (gameSlug: string, profileId?: number) => {
    const { data } = await api.get<{
      achievements: Achievement[];
      total: number;
      unlocked_count: number;
    }>(`/achievements/${gameSlug}`, playerConfig(profileId));
    return data;
  },

  unlock: async (
    gameSlug: string,
    achievementSlug: string,
    profileId?: number,
  ) => {
    const { data } = await api.post<{ message: string; unlocked: boolean }>(
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

export default api;
