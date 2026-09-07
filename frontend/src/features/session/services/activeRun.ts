import { statsApi, ApiError } from "../../../api/client";
import type { Completion } from "../../../shared/persistence/sessionQueue";
import type { GameMetrics } from "../../../contracts/gameplay";
import { limits } from "../../../contracts/gameplay";

export interface ActiveRun {
  id: string;
  profileId: number;
  difficulty: "easy" | "normal" | "hard";
  confirmed: boolean;
  seconds: number;
  since: number | null;
  completion?: Completion;
  mode: string;
  rulesVersion: number;
}
export function stopRunClock(run: ActiveRun | null, now: number): void {
  if (run && run.since !== null) {
    run.seconds += Math.max(0, now - run.since) / 1000;
    run.since = null;
  }
}
export function completeRun(
  run: ActiveRun | null,
  slug: string,
  score: number,
  metrics: GameMetrics,
): Completion | null {
  if (!run?.confirmed) return null;
  run.completion ??= {
    slug,
    sessionId: run.id,
    profileId: run.profileId,
    difficulty: run.difficulty,
    seconds: Math.min(limits.playtime_seconds, Math.floor(run.seconds)),
    score,
    metrics,
    mode: run.mode,
    rulesVersion: run.rulesVersion,
  };
  return run.completion;
}

/** Capture the run rather than re-reading a possibly replaced ref after the request. */
export async function startRun(
  slug: string,
  run: ActiveRun,
  notify: (message: string, type: "info") => void,
): Promise<void> {
  try {
    await statsApi.startSession(slug, run.id, run.profileId);
  } catch (error) {
    if (error instanceof ApiError && error.status && error.status < 500)
      throw error;
    notify(
      "Playing locally. Results will sync when the console reconnects.",
      "info",
    );
  }
  run.confirmed = true;
}
