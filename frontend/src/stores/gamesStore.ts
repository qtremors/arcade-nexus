/**
 * Games Store - Game store/catalog state
 */
import { create } from 'zustand';
import { gamesApi } from '../api/client';
import type { Game } from '../api/client';

interface GamesState {
    games: Game[];
    categories: { value: string; label: string }[];
    selectedCategory: string | null;
    searchQuery: string;
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchGames: (category?: string, search?: string) => Promise<void>;
    fetchCategories: () => Promise<void>;
    setCategory: (category: string | null) => void;
    setSearchQuery: (query: string) => void;
    getGameBySlug: (slug: string) => Game | undefined;
}

export const useGamesStore = create<GamesState>()((set, get) => ({
    games: [],
    categories: [],
    selectedCategory: null,
    searchQuery: '',
    isLoading: false,
    error: null,

    fetchGames: async (category, search) => {
        set({ isLoading: true, error: null });
        try {
            const response = await gamesApi.list(category, search);
            set({ games: response.games, isLoading: false });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    fetchCategories: async () => {
        try {
            const categories = await gamesApi.getCategories();
            set({ categories });
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        }
    },

    setCategory: (category) => {
        set({ selectedCategory: category });
        get().fetchGames(category || undefined, get().searchQuery || undefined);
    },

    setSearchQuery: (query) => {
        set({ searchQuery: query });
        get().fetchGames(get().selectedCategory || undefined, query || undefined);
    },

    getGameBySlug: (slug) => {
        return get().games.find((g) => g.slug === slug);
    },
}));
