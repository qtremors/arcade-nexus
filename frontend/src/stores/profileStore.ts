/**
 * Profile Store - Manages user profiles (Zustand)
 */
import { create } from 'zustand';
import type { Profile, OverallStats } from '../api/client';
import { profilesApi, statsApi } from '../api/client';

interface ProfileState {
    activeProfile: Profile | null;
    profiles: Profile[];
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;
    overallStats: OverallStats | null;
    lastStatsFetch: number;

    // Actions
    initialize: () => Promise<void>;
    fetchProfiles: () => Promise<void>;
    createProfile: (username: string, avatar?: string) => Promise<Profile>;
    updateProfile: (id: number, updates: { username?: string; avatar?: string }) => Promise<void>;
    switchProfile: (id: number) => Promise<void>;
    deleteProfile: (id: number) => Promise<void>;
    fetchOverallStats: (force?: boolean) => Promise<void>;
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
    activeProfile: null,
    profiles: [],
    isLoading: false,
    isInitialized: false,
    error: null,
    overallStats: null,
    lastStatsFetch: 0,

    initialize: async () => {
        if (get().isInitialized) return;

        set({ isLoading: true, error: null });
        try {
            const response = await profilesApi.list();
            const active = response.profiles.find(p => p.id === response.active_id) || null;
            set({
                profiles: response.profiles,
                activeProfile: active,
                isInitialized: true,
                isLoading: false,
            });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false, isInitialized: true });
        }
    },

    fetchProfiles: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await profilesApi.list();
            const active = response.profiles.find(p => p.id === response.active_id) || null;
            set({
                profiles: response.profiles,
                activeProfile: active,
                isLoading: false,
            });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    createProfile: async (username, avatar) => {
        set({ isLoading: true, error: null });
        try {
            const profile = await profilesApi.create(username, avatar);
            // Refresh profiles list
            await get().fetchProfiles();
            return profile;
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
            throw err;
        }
    },

    updateProfile: async (id, updates) => {
        set({ isLoading: true, error: null });
        try {
            const updated = await profilesApi.update(id, updates);
            set(state => ({
                profiles: state.profiles.map(p => p.id === id ? updated : p),
                activeProfile: state.activeProfile?.id === id ? updated : state.activeProfile,
                isLoading: false,
            }));
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
            throw err;
        }
    },

    switchProfile: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const activated = await profilesApi.activate(id);
            set({
                // Don't manually toggle is_default, rely on activeProfile state
                activeProfile: activated,
                isLoading: false,
            });
            // Refresh profiles to ensure consistency if backend updates flags
            await get().fetchProfiles();
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
            throw err;
        }
    },

    deleteProfile: async (id) => {
        set({ isLoading: true, error: null });
        try {
            await profilesApi.delete(id);
            // Refresh to get new active profile if needed
            await get().fetchProfiles();
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
            throw err;
        }
    },

    fetchOverallStats: async (force = false) => {
        const { activeProfile } = get();
        const CACHE_DURATION = 60 * 1000; // 1 minute cache

        // Skip if cached and recent (unless forced)
        if (!activeProfile) return;

        // Use local variable for check to avoid state drift during async
        const state = get();
        if (!force && state.overallStats && (Date.now() - state.lastStatsFetch < CACHE_DURATION)) {
            return;
        }

        try {
            const stats = await statsApi.getOverall();
            set({
                overallStats: stats,
                lastStatsFetch: Date.now()
            });
        } catch (err) {
            console.error('Failed to fetch stats:', err);
            // Don't set global error for background stats fetch to avoid blocking UI
        }
    },
}));
