import { z } from "zod";
import { API_BASE_URL, statsApi, achievementsApi } from "../api/client";
export interface Completion {
  slug: string;
  sessionId: string;
  profileId: number;
  seconds: number;
  score: number;
  difficulty: "easy" | "normal" | "hard";
  metrics: { jumps?: number; max_altitude?: number; crashed?: boolean };
}
const prefix = "nexus-result-v1:";
const pending = new Map<string, Completion>();
const schema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sessionId: z.uuid(),
  profileId: z.number().int().positive(),
  seconds: z.number().int().min(0).max(604800),
  score: z.number().int().min(0).max(2147483647),
  difficulty: z.enum(["easy", "normal", "hard"]),
  metrics: z
    .object({
      jumps: z.number().int().min(0).max(1000000).optional(),
      max_altitude: z.number().min(0).max(10000000).optional(),
      crashed: z.boolean().optional(),
    })
    .default({}),
});
const read = (): Completion[] => {
  try {
    for (const key of Object.keys(localStorage).filter((key) =>
      key.startsWith(prefix),
    )) {
      try {
        const result = schema.safeParse(
          JSON.parse(localStorage.getItem(key) ?? "null"),
        );
        if (result.success && key === prefix + result.data.sessionId)
          pending.set(result.data.sessionId, result.data);
      } catch {
        /* Skip a malformed entry without blocking the rest. */
      }
    }
  } catch {
    /* Continue with the in-memory queue if storage is blocked. */
  }
  return [...pending.values()];
};
export function enqueueCompletion(completion: Completion): boolean {
  const item = schema.parse(completion);
  pending.set(item.sessionId, item);
  try {
    localStorage.setItem(prefix + item.sessionId, JSON.stringify(item));
    return true;
  } catch {
    return false;
  }
}
const inFlight = new Map<
  string,
  Promise<{ is_new_high_score: boolean; high_score: number }>
>();
export function sendCompletion(item: Completion) {
  const previous = inFlight.get(item.sessionId);
  if (previous) return previous;
  const promise = (async () => {
    await statsApi.recordSession(
      item.slug,
      item.seconds,
      item.score,
      item.difficulty,
      item.sessionId,
      item.profileId,
      item.metrics,
    );
    const score = await statsApi.submitScore(
      item.slug,
      item.score,
      item.profileId,
    );
    const { achievements } = await achievementsApi.getForGame(
      item.slug,
      item.profileId,
    );
    for (const award of achievements.filter((a) => !a.unlocked)) {
      const condition = award.unlock_condition ?? {};
      const qualifies =
        typeof condition.score === "number"
          ? item.score >= condition.score
          : typeof condition.jumps === "number"
            ? (item.metrics?.jumps ?? 0) >= condition.jumps
            : typeof condition.max_altitude === "number"
              ? (item.metrics?.max_altitude ?? 0) >= condition.max_altitude
              : typeof condition.flight_seconds === "number" &&
                item.seconds >= condition.flight_seconds &&
                item.metrics?.crashed === false;
      if (qualifies)
        await achievementsApi.unlock(item.slug, award.slug, item.profileId);
    }
    pending.delete(item.sessionId);
    try {
      localStorage.removeItem(prefix + item.sessionId);
    } catch {
      /* Already synchronized. */
    }
    return score;
  })().finally(() => inFlight.delete(item.sessionId));
  inFlight.set(item.sessionId, promise);
  return promise;
}
export async function flushCompletions(): Promise<void> {
  for (const item of read()) {
    try {
      await sendCompletion(item);
    } catch {
      /* Retain failures for next retry. */
    }
  }
}
export function sendCompletionOnExit(item: Completion): void {
  void fetch(`${API_BASE_URL}/stats/${item.slug}/session`, {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      "X-Profile-ID": String(item.profileId),
    },
    body: JSON.stringify({
      session_id: item.sessionId,
      playtime_seconds: item.seconds,
      score: item.score,
      difficulty: item.difficulty,
      metrics: item.metrics,
    }),
  }).catch(() => {});
}
