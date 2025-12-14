/**
 * API Client - Axios wrapper for local app (no auth required)
 */
import axios from 'axios';
import type { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    // Extract error message
    const message = error.response?.data?.detail || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
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
  id: number;
  slug: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  category: 'arcade' | 'puzzle' | 'action' | 'strategy';
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

export interface OverallStats {
  total_playtime_seconds: number;
  total_games_played: number;
  total_sessions: number;
  games: GameStats[];
}

export interface Achievement {
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
    const { data } = await api.get<ProfileListResponse>('/profiles');
    return data;
  },

  getActive: async () => {
    const { data } = await api.get<Profile | null>('/profiles/active');
    return data;
  },

  create: async (username: string, avatar?: string) => {
    const { data } = await api.post<Profile>('/profiles', { username, avatar });
    return data;
  },

  get: async (id: number) => {
    const { data } = await api.get<Profile>(`/profiles/${id}`);
    return data;
  },

  update: async (id: number, updates: { username?: string; avatar?: string }) => {
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

    const { data } = await api.get<{ games: Game[]; total: number }>('/games', { params });
    return data;
  },

  get: async (slug: string) => {
    const { data } = await api.get<Game>(`/games/${slug}`);
    return data;
  },

  getCategories: async () => {
    const { data } = await api.get<{ value: string; label: string }[]>('/games/categories');
    return data;
  },
};

export const libraryApi = {
  list: async () => {
    const { data } = await api.get<LibraryEntry[]>('/library');
    return data;
  },

  add: async (gameId: number) => {
    const { data } = await api.post<{ message: string; entry: LibraryEntry }>(`/library/${gameId}`);
    return data;
  },

  remove: async (gameId: number) => {
    await api.delete(`/library/${gameId}`);
  },
};

export const savesApi = {
  list: async (gameSlug: string) => {
    const { data } = await api.get<{ saves: SaveData[]; total: number }>(`/saves/${gameSlug}`);
    return data;
  },

  create: async (gameSlug: string, slot: number, saveData: Record<string, unknown>, name?: string) => {
    const { data } = await api.post<SaveData>(`/saves/${gameSlug}`, {
      slot,
      name,
      data: saveData,
    });
    return data;
  },

  delete: async (gameSlug: string, slot: number) => {
    await api.delete(`/saves/${gameSlug}/${slot}`);
  },
};

export const statsApi = {
  getOverall: async () => {
    const { data } = await api.get<OverallStats>('/stats');
    return data;
  },

  getForGame: async (gameSlug: string) => {
    const { data } = await api.get<GameStats>(`/stats/${gameSlug}`);
    return data;
  },

  recordSession: async (gameSlug: string, playtimeSeconds: number) => {
    const { data } = await api.post(`/stats/${gameSlug}/session`, {
      playtime_seconds: playtimeSeconds,
    });
    return data;
  },

  submitScore: async (gameSlug: string, score: number) => {
    const { data } = await api.post<{ is_new_high_score: boolean; high_score: number }>(
      `/stats/${gameSlug}/score`,
      { score }
    );
    return data;
  },
};

export const achievementsApi = {
  getAll: async () => {
    const { data } = await api.get<{ achievements: Achievement[]; total: number; unlocked_count: number }>(
      '/achievements'
    );
    return data;
  },

  getForGame: async (gameSlug: string) => {
    const { data } = await api.get<{ achievements: Achievement[]; total: number; unlocked_count: number }>(
      `/achievements/${gameSlug}`
    );
    return data;
  },

  unlock: async (gameSlug: string, achievementSlug: string) => {
    const { data } = await api.post<{ message: string; unlocked: boolean }>('/achievements/unlock', {
      game_slug: gameSlug,
      achievement_slug: achievementSlug,
    });
    return data;
  },
};

export default api;
