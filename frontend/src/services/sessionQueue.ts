import { z } from "zod";
import { watchVisibleTask } from "./background";
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
const memoryOnly = new Set<string>();
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
      ended: z.boolean().optional(),
      jumps: z.number().int().min(0).max(1000000).optional(),
      max_altitude: z.number().min(0).max(10000000).optional(),
      crashed: z.boolean().optional(),
      gates: z.number().int().min(0).max(1000000).optional(),
      misses: z.number().int().min(0).max(1000000).optional(),
      sectors: z.number().int().min(0).max(1000000).optional(),
      lives: z.number().int().min(0).max(3).optional(),
      highest_tile: z.number().int().min(0).max(1048576).optional(),
      completed: z.boolean().optional(),
      elapsed_ms: z.number().int().min(1).max(604800000).optional(),
      medal: z.enum(["gold", "silver", "bronze"]).optional(),
      max_speed: z.number().min(0).max(2000).optional(),
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
    const stored = new Set<string>();
    for (const key of Object.keys(localStorage).filter((k) =>
      k.startsWith(prefix),
    )) {
      const value = localStorage.getItem(key);
      try {
        const parsed = completionSchema.safeParse(JSON.parse(value ?? "null"));
        if (parsed.success && key === prefix + parsed.data.sessionId) {
          stored.add(parsed.data.sessionId);
          if (!memoryOnly.has(parsed.data.sessionId))
            pending.set(parsed.data.sessionId, parsed.data);
        }
      } catch {
        /* Preserve malformed data for export, without blocking valid results. */
      }
    }
    for (const id of pending.keys())
      if (!stored.has(id) && !memoryOnly.has(id)) pending.delete(id);
  } catch {
    /* Memory-only fallback. */
  }
  return [...pending.values()];
}
function persistCompletion(item: Completion): boolean {
  pending.set(item.sessionId, item);
  try {
    localStorage.setItem(prefix + item.sessionId, JSON.stringify(item));
    memoryOnly.delete(item.sessionId);
    return true;
  } catch {
    memoryOnly.add(item.sessionId);
    return false;
  }
}
export function enqueueCompletion(completion: Completion): boolean {
  const item = completionSchema.parse(completion);
  const old = pendingResults().find(
    (value) => value.sessionId === item.sessionId,
  );
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
  const durable = persistCompletion(saved);
  changed();
  return durable;
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
  const wasQueued = pendingResults().some(
    (value) => value.sessionId === item.sessionId,
  );
  const promise = progressApi
    .complete(item.slug, payload(item), item.profileId)
    .then((result) => {
      pending.delete(item.sessionId);
      memoryOnly.delete(item.sessionId);
      try {
        localStorage.removeItem(prefix + item.sessionId);
      } catch {
        /* Receipt is already durable. */
      }
      changed();
      return result;
    })
    .catch((error: unknown) => {
      const current = pendingResults().find(
        (value) => value.sessionId === item.sessionId,
      );
      // Another tab may have completed and removed this durable result while this request failed.
      if (wasQueued && !current) {
        changed();
        throw error;
      }
      const attempts = (current?.attempts ?? item.attempts ?? 0) + 1;
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
      persistCompletion(failed);
      changed();
      throw error;
    })
    .finally(() => inFlight.delete(item.sessionId));
  inFlight.set(item.sessionId, promise);
  return promise;
}
export async function flushCompletions(
  force = false,
  signal?: AbortSignal,
): Promise<void> {
  const flush = async () => {
    // Reload after acquiring the lock: another tab may have acknowledged these results.
    for (const item of pendingResults()) {
      if (signal?.aborted) return;
      if (!force && (item.blocked || (item.retryAt ?? 0) > Date.now()))
        continue;
      try {
        await sendCompletion(item);
      } catch {
        /* Retained with a visible error and retry policy. */
      }
    }
  };
  if (navigator.locks?.request)
    await navigator.locks.request("nexus-completion-sync", { signal }, flush);
  else await flush(); // Durable server receipts keep fallback retries idempotent.
}
export function startCompletionSync() {
  return watchVisibleTask(
    (signal) => flushCompletions(false, signal),
    () => {
      const due = pendingResults().filter((item) => !item.blocked);
      return due.length
        ? Math.max(
            0,
            Math.min(...due.map((item) => item.retryAt ?? 0)) - Date.now(),
          )
        : null;
    },
    ["nexus-progress", "storage"],
  );
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
