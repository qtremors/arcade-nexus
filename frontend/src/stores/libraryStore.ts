/**
 * Library Store - User's game library state
 */
import { create } from 'zustand';
import { libraryApi } from '../api/client';
import type { LibraryEntry } from '../api/client';

interface LibraryState {
    entries: LibraryEntry[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchLibrary: () => Promise<void>;
    addGame: (gameId: number) => Promise<void>;
    removeGame: (gameId: number) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
    entries: [],
    isLoading: false,
    error: null,

    fetchLibrary: async () => {
        set({ isLoading: true, error: null });
        try {
            const entries = await libraryApi.list();
            set({ entries, isLoading: false });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    addGame: async (gameId) => {
        try {
            const response = await libraryApi.add(gameId);
            set({ entries: [...get().entries, response.entry] });
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    removeGame: async (gameId) => {
        const previousEntries = get().entries;
        // Optimistic update
        set({ entries: previousEntries.filter((e) => e.game.id !== gameId) });
        try {
            await libraryApi.remove(gameId);
        } catch (err) {
            // Rollback
            set({ entries: previousEntries, error: (err as Error).message });
            throw err;
        }
    },
}));
