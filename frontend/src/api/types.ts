import type { ApiSchemas } from "../contracts/api.generated";
export type User = ApiSchemas["ProfileResponse"];
export type Game = Omit<ApiSchemas["GameResponse"], "config"> & {
  config: Record<string, unknown>;
};
export type LibraryEntry = Omit<ApiSchemas["LibraryEntryResponse"], "game"> & {
  game: Game;
};
export type Achievement = ApiSchemas["AchievementResponse"];
export type SaveData = ApiSchemas["SaveResponse"];
export type GameStats = ApiSchemas["GameStatsResponse"];
export type GameSession = ApiSchemas["SessionResponse"];
export type CompletionReceipt = ApiSchemas["CompletionReceipt"];
export type ModeRecord = ApiSchemas["ModeRecord"];
export type HistoryGame = ApiSchemas["HistoryGame"];
export type BackupPreview = ApiSchemas["BackupPreview"];
export type SnapshotInfo = ApiSchemas["SnapshotInfo"];
export type BackupStatus = ApiSchemas["BackupStatus"];
export type OverallStats = ApiSchemas["StatsResponse"];
export type Profile = ApiSchemas["ProfileResponse"];
export type ProfileListResponse = ApiSchemas["ProfileListResponse"];
export interface HistoryFilters {
  mode?: string;
  difficulty?: string;
  since?: string;
  before?: string;
  sort?:
    "game_title" | "end_time" | "difficulty" | "duration_seconds" | "score";
  direction?: "asc" | "desc";
}
