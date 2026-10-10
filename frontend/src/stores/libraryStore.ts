import { create } from "zustand";
import { libraryApi, getApiProfileId } from "../api/client";
import type { LibraryEntry } from "../api/client";
interface LibraryState {
  entries: LibraryEntry[];
  profileId: number | null;
  isLoading: boolean;
  error: string | null;
  fetchLibrary: () => Promise<void>;
  addGame: (id: number) => Promise<void>;
  removeGame: (id: number) => Promise<void>;
}
let revision = 0;
export const useLibraryStore = create<LibraryState>()((set, get) => ({
  entries: [],
  profileId: null,
  isLoading: false,
  error: null,
  fetchLibrary: async () => {
    const id = getApiProfileId();
    const request = ++revision;
    set({
      isLoading: true,
      error: null,
      ...(get().profileId !== id ? { entries: [], profileId: id } : {}),
    });
    try {
      const entries = await libraryApi.list();
      if (request === revision && id === getApiProfileId())
        set({ entries, isLoading: false });
    } catch (err) {
      if (request === revision && id === getApiProfileId())
        set({ isLoading: false, error: (err as Error).message });
    }
  },
  addGame: async (id) => {
    await libraryApi.add(id);
    await get().fetchLibrary();
  },
  removeGame: async (id) => {
    await libraryApi.remove(id);
    await get().fetchLibrary();
  },
}));
