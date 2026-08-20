import { create } from "zustand";
import { profilesApi, statsApi, setApiProfileId } from "../../api/client";
import type { Profile, OverallStats } from "../../api/client";

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
let profilesRequest: {
  revision: number;
  token: symbol;
  promise: Promise<void>;
} | null = null;
let profilesRevision = 0;
let selectionRevision = 0;
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
    const revision = profilesRevision;
    if (profilesRequest?.revision === revision) return profilesRequest.promise;
    const token = Symbol();
    set({ isLoading: true, error: null });
    const promise = (async () => {
      try {
        const response = await profilesApi.list();
        if (revision !== profilesRevision) return;
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
        if (revision === profilesRevision)
          set({ error: (err as Error).message });
      } finally {
        if (profilesRequest?.token === token) {
          profilesRequest = null;
          set({ isLoading: false });
        }
      }
    })();
    profilesRequest = { revision, token, promise };
    return promise;
  },
  createProfile: async (username, avatar) => {
    const profile = await profilesApi.create(username, avatar);
    profilesRevision++;
    set((state) => ({
      profiles: state.profiles.some((p) => p.id === profile.id)
        ? state.profiles.map((p) => (p.id === profile.id ? profile : p))
        : [...state.profiles, profile],
    }));
    // New profiles become the player in this tab, even when other profiles exist.
    await get().switchProfile(profile.id);
    return profile;
  },
  updateProfile: async (id, updates) => {
    const updated = await profilesApi.update(id, updates);
    profilesRevision++;
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === id ? updated : p)),
      activeProfile:
        state.activeProfile?.id === id ? updated : state.activeProfile,
    }));
  },
  switchProfile: async (id) => {
    const selection = ++selectionRevision;
    set({ isLoading: true, error: null });
    try {
      const active = await profilesApi.activate(id);
      if (selection !== selectionRevision) return;
      remember(id);
      profileVersion++;
      profilesRevision++;
      set((state) => ({
        activeProfile: active,
        profiles: state.profiles.map((p) => ({
          ...(p.id === id ? active : p),
          is_default: p.id === id,
        })),
        overallStats: null,
        lastStatsFetch: 0,
        isLoading: false,
        isInitialized: true,
      }));
      await get().fetchProfiles();
    } catch (err) {
      if (selection === selectionRevision)
        set({ isLoading: false, error: (err as Error).message });
      throw err;
    }
  },
  deleteProfile: async (id) => {
    await profilesApi.delete(id);
    profilesRevision++;
    set((state) => ({ profiles: state.profiles.filter((p) => p.id !== id) }));
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
