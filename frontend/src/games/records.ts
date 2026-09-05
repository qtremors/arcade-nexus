import { getDescriptor, gameSlugs } from "./descriptors";
export function timeRanked(slug: string, mode: string, rules?: number) {
  if (!gameSlugs.includes(slug)) return false;
  const descriptor = getDescriptor(slug),
    definition = descriptor.modes.find((m) => m.id === mode);
  return (
    definition?.ranking === "time" &&
    (rules ?? descriptor.rulesVersion) >= definition.rankingSince
  );
}
export function formatTime(ms: number | null | undefined) {
  if (ms == null) return "No completed sprint";
  return `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(3).padStart(6, "0")}`;
}
