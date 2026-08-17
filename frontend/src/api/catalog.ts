import api, { playerConfig } from "./transport";
import type { ApiSchemas } from "../contracts/api.generated";
import type { Game } from "./types";
function gameModel(game: ApiSchemas["GameResponse"]): Game {
  return { ...game, config: game.config ?? {} };
}
export const gamesApi = {
  list: async (category?: string, search?: string) => {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (search) params.search = search;

    const { data } = await api.get<ApiSchemas["GameListResponse"]>("/games", {
      params,
    });
    return { ...data, games: data.games.map(gameModel) };
  },

  get: async (slug: string) => {
    const { data } = await api.get<ApiSchemas["GameResponse"]>(
      `/games/${slug}`,
    );
    return gameModel(data);
  },

  getCategories: async () => {
    const { data } =
      await api.get<ApiSchemas["GameCategory"][]>("/games/categories");
    return data;
  },
};
export const libraryApi = {
  list: async () => {
    const { data } = await api.get<ApiSchemas["LibraryEntryResponse"][]>(
      "/library",
      playerConfig(),
    );
    return data.map((entry) => ({ ...entry, game: gameModel(entry.game) }));
  },

  add: async (gameId: number) => {
    const { data } = await api.post<ApiSchemas["LibraryAddResponse"]>(
      `/library/${gameId}`,
      undefined,
      playerConfig(),
    );
    return {
      ...data,
      entry: { ...data.entry, game: gameModel(data.entry.game) },
    };
  },

  remove: async (gameId: number) => {
    await api.delete(`/library/${gameId}`, playerConfig());
  },
};
