import api from "./transport";
import type { Profile, ProfileListResponse } from "./types";
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
