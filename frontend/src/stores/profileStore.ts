import { create } from "zustand";
import { profilesApi, statsApi, setApiProfileId } from "../api/client";
import type { Profile, OverallStats } from "../api/client";

interface ProfileState {
  activeProfile: Profile | null;
  profiles: Profile[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  overallStats: OverallStats | null;
  lastStatsFetch: number;
  initialize: () => Promise<void>;
  fetchProfiles: () => Promise<void>;
  createProfile: (username: string, avatar?: string) => Promise<Profile>;
  updateProfile: (
    id: number,
    updates: { username?: string; avatar?: string },
  ) => Promise<void>;
  switchProfile: (id: number) => Promise<void>;
  deleteProfile: (id: number) => Promise<void>;
  fetchOverallStats: (force?: boolean) => Promise<void>;
}
let profilesRequest: Promise<void> | null = null;
let profileVersion = 0;
let statsRequest: {
  id: number;
  version: number;
  token: symbol;
  promise: Promise<void>;
} | null = null;
const remember = (id: number | null) => {
  setApiProfileId(id);
  try {
    if (id === null) sessionStorage.removeItem("nexus-profile");
    else sessionStorage.setItem("nexus-profile", String(id));
  } catch {
    /* Browser storage may be disabled. */
  }
};
const remembered = () => {
  try {
    return Number(sessionStorage.getItem("nexus-profile")) || null;
  } catch {
    return null;
  }
};
export const useProfileStore = create<ProfileState>()((set, get) => ({
  activeProfile: null,
  profiles: [],
  isLoading: false,
  isInitialized: false,
  error: null,
  overallStats: null,
  lastStatsFetch: 0,
  initialize: async () => {
    if (!get().isInitialized) await get().fetchProfiles();
  },
  fetchProfiles: () => {
    if (profilesRequest) return profilesRequest;
    set({ isLoading: true, error: null });
    profilesRequest = (async () => {
      try {
        const response = await profilesApi.list();
        const previous = get().activeProfile;
        const preferred = previous?.id ?? remembered() ?? response.active_id;
        const active =
          response.profiles.find((p) => p.id === preferred) ??
          response.profiles.find((p) => p.id === response.active_id) ??
          null;
        if (previous?.id !== active?.id) profileVersion++;
        remember(active?.id ?? null);
        set({
          profiles: response.profiles,
          activeProfile: active,
          isInitialized: true,
          isLoading: false,
          ...(previous?.id !== active?.id
            ? { overallStats: null, lastStatsFetch: 0 }
            : {}),
        });
      } catch (err) {
        set({ error: (err as Error).message, isLoading: false });
      } finally {
        profilesRequest = null;
      }
    })();
    return profilesRequest;
  },
  createProfile: async (username, avatar) => {
    const profile = await profilesApi.create(username, avatar);
    // New profiles become the player in this tab, even when other profiles exist.
    await get().switchProfile(profile.id);
    return profile;
  },
  updateProfile: async (id, updates) => {
    const updated = await profilesApi.update(id, updates);
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === id ? updated : p)),
      activeProfile:
        state.activeProfile?.id === id ? updated : state.activeProfile,
    }));
  },
  switchProfile: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const active = await profilesApi.activate(id);
      remember(id);
      profileVersion++;
      set((state) => ({
        activeProfile: active,
        profiles: state.profiles.map((p) => ({
          ...p,
          is_default: p.id === id,
        })),
        overallStats: null,
        lastStatsFetch: 0,
        isLoading: false,
        isInitialized: true,
      }));
      await get().fetchProfiles();
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
      throw err;
    }
  },
  deleteProfile: async (id) => {
    await profilesApi.delete(id);
    if (get().activeProfile?.id === id) {
      remember(null);
      profileVersion++;
      set({ activeProfile: null, overallStats: null, lastStatsFetch: 0 });
    }
    await get().fetchProfiles();
  },
  fetchOverallStats: async (force = false) => {
    const id = get().activeProfile?.id;
    if (
      !id ||
      (!force &&
        get().overallStats &&
        Date.now() - get().lastStatsFetch < 60000)
    )
      return;
    const version = profileVersion;
    const token = Symbol();
    if (statsRequest?.id === id && statsRequest.version === version)
      return statsRequest.promise;
    const promise = (async () => {
      try {
        const stats = await statsApi.getOverall(id);
        if (get().activeProfile?.id === id && profileVersion === version)
          set({ overallStats: stats, lastStatsFetch: Date.now() });
      } finally {
        if (statsRequest?.token === token) statsRequest = null;
      }
    })();
    statsRequest = { id, version, token, promise };
    return promise;
  },
}));
