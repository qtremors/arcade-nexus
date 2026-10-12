import { z } from "zod";
import { API_BASE_URL, ApiError, progressApi } from "../api/client";
import type { CompletionReceipt } from "../api/client";
import type { GameMetrics } from "../sdk/GameSDK";
export interface Completion {
  slug: string;
  sessionId: string;
  profileId: number;
  seconds: number;
  score: number;
  difficulty: "easy" | "normal" | "hard";
  metrics: GameMetrics;
  mode?: string;
  rulesVersion?: number;
  attempts?: number;
  retryAt?: number;
  blocked?: boolean;
  error?: string;
}
const prefix = "nexus-result-v1:";
const pending = new Map<string, Completion>();
export const completionSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sessionId: z.uuid(),
  profileId: z.number().int().positive(),
  seconds: z.number().int().min(0).max(604800),
  score: z.number().int().min(0).max(2147483647),
  difficulty: z.enum(["easy", "normal", "hard"]),
  mode: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .default("classic"),
  rulesVersion: z.number().int().min(1).max(10000).default(1),
  metrics: z
    .object({
      jumps: z.number().int().min(0).max(1000000).optional(),
      max_altitude: z.number().min(0).max(10000000).optional(),
      crashed: z.boolean().optional(),
      gates: z.number().int().min(0).max(1000000).optional(),
      misses: z.number().int().min(0).max(1000000).optional(),
      sectors: z.number().int().min(0).max(3).optional(),
      lives: z.number().int().min(0).max(3).optional(),
      highest_tile: z.number().int().min(0).max(1048576).optional(),
      completed: z.boolean().optional(),
      medal: z.enum(["gold", "silver", "bronze"]).optional(),
      max_speed: z.number().min(0).max(450).optional(),
    })
    .default({}),
  attempts: z.number().int().nonnegative().optional(),
  retryAt: z.number().nonnegative().optional(),
  blocked: z.boolean().optional(),
  error: z.string().optional(),
});
const changed = () => window.dispatchEvent(new Event("nexus-progress"));
export function pendingResults(): Completion[] {
  try {
    for (const key of Object.keys(localStorage).filter((k) =>
      k.startsWith(prefix),
    )) {
      try {
        const parsed = completionSchema.safeParse(
          JSON.parse(localStorage.getItem(key) ?? "null"),
        );
        if (parsed.success && key === prefix + parsed.data.sessionId)
          pending.set(parsed.data.sessionId, parsed.data);
      } catch {
        /* Preserve malformed data for export, without blocking valid results. */
      }
    }
  } catch {
    /* Memory-only fallback. */
  }
  return [...pending.values()];
}
export function enqueueCompletion(completion: Completion): boolean {
  const item = completionSchema.parse(completion);
  const old = pending.get(item.sessionId);
  const saved = {
    ...item,
    ...(old
      ? {
          attempts: old.attempts,
          retryAt: old.retryAt,
          blocked: old.blocked,
          error: old.error,
        }
      : {}),
  };
  pending.set(item.sessionId, saved);
  try {
    localStorage.setItem(prefix + item.sessionId, JSON.stringify(saved));
    changed();
    return true;
  } catch {
    changed();
    return false;
  }
}
const payload = (item: Completion) => ({
  session_id: item.sessionId,
  playtime_seconds: item.seconds,
  score: item.score,
  difficulty: item.difficulty,
  metrics: item.metrics,
  mode: item.mode ?? "classic",
  rules_version: item.rulesVersion ?? 1,
});
const inFlight = new Map<string, Promise<CompletionReceipt>>();
export function sendCompletion(item: Completion): Promise<CompletionReceipt> {
  const previous = inFlight.get(item.sessionId);
  if (previous) return previous;
  const promise = progressApi
    .complete(item.slug, payload(item), item.profileId)
    .then((result) => {
      pending.delete(item.sessionId);
      try {
        localStorage.removeItem(prefix + item.sessionId);
      } catch {
        /* Receipt is already durable. */
      }
      changed();
      return result;
    })
    .catch((error: unknown) => {
      const attempts = (pending.get(item.sessionId)?.attempts ?? 0) + 1;
      const blocked =
        error instanceof ApiError &&
        !!error.status &&
        error.status >= 400 &&
        error.status < 500 &&
        ![408, 429].includes(error.status);
      const failed = {
        ...item,
        attempts,
        blocked,
        retryAt:
          Date.now() + Math.min(300000, 1000 * 2 ** Math.min(attempts, 8)),
        error: error instanceof Error ? error.message : String(error),
      };
      pending.set(item.sessionId, failed);
      try {
        localStorage.setItem(prefix + item.sessionId, JSON.stringify(failed));
      } catch {
        /* Memory retained. */
      }
      changed();
      throw error;
    })
    .finally(() => inFlight.delete(item.sessionId));
  inFlight.set(item.sessionId, promise);
  return promise;
}
export async function flushCompletions(force = false): Promise<void> {
  for (const item of pendingResults()) {
    if (!force && (item.blocked || (item.retryAt ?? 0) > Date.now())) continue;
    try {
      await sendCompletion(item);
    } catch {
      /* Retained with a visible error and retry policy. */
    }
  }
}
export function sendCompletionOnExit(item: Completion): void {
  void fetch(`${API_BASE_URL}/progress/${item.slug}/complete`, {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      "X-Profile-ID": String(item.profileId),
    },
    body: JSON.stringify(payload(item)),
  }).catch(() => {});
}
