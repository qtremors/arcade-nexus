/**
 * Profile Store - Manages user profiles (Zustand)
 */
import { create } from 'zustand';
import { profilesApi } from '../api/client';
import type { Profile } from '../api/client';

interface ProfileState {
    activeProfile: Profile | null;
    profiles: Profile[];
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;

    // Actions
    initialize: () => Promise<void>;
    fetchProfiles: () => Promise<void>;
    createProfile: (username: string, avatar?: string) => Promise<Profile>;
    updateProfile: (id: number, updates: { username?: string; avatar?: string }) => Promise<void>;
    switchProfile: (id: number) => Promise<void>;
    deleteProfile: (id: number) => Promise<void>;
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
    activeProfile: null,
    profiles: [],
    isLoading: false,
    isInitialized: false,
    error: null,

    initialize: async () => {
        if (get().isInitialized) return;

        set({ isLoading: true, error: null });
        try {
            const response = await profilesApi.list();
            const active = response.profiles.find(p => p.is_default) || null;
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
            const active = response.profiles.find(p => p.is_default) || null;
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
            set(state => ({
                profiles: state.profiles.map(p => ({
                    ...p,
                    is_default: p.id === id,
                })),
                activeProfile: activated,
                isLoading: false,
            }));
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
}));
