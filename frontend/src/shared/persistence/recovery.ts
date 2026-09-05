import { progressApi } from "../../api/client";
import { readSave } from "./saves";
import type { SaveEnvelope } from "./saves";
const prefix = "nexus-recovery-v2:";
const key = (id: number, slug: string) => `${prefix}${id}:${slug}`;
const memory = new Map<string, SaveEnvelope>();
type Operation =
  | { kind: "save"; value: SaveEnvelope }
  | { kind: "delete"; sessionId?: string };
const writes = new Map<string, Operation[]>();
function enqueue(profileId: number, slug: string, operation: Operation) {
  const id = key(profileId, slug);
  const queue = writes.get(id);
  if (queue) {
    const last = queue.at(-1);
    // A slow server needs the newest snapshot, not every intermediate board.
    // Deletes remain barriers so an old session cannot erase a newer run.
    if (
      last?.kind === "save" &&
      (operation.kind === "save" ||
        !operation.sessionId ||
        last.value.session_id === operation.sessionId)
    )
      queue[queue.length - 1] = operation;
    else if (!(
      last?.kind === "delete" &&
      operation.kind === "delete" &&
      last.sessionId === operation.sessionId
    ))
      queue.push(operation);
    return;
  }
  const pending = [operation];
  writes.set(id, pending);
  void (async () => {
    try {
      while (pending.length) {
        const next = pending.shift()!;
        try {
          if (next.kind === "save")
            await progressApi.saveRecovery(slug, next.value, profileId);
          else
            await progressApi.deleteRecovery(slug, profileId, next.sessionId);
        } catch {
          /* Browser/memory recovery remains available during server downtime. */
        }
      }
    } finally {
      writes.delete(id);
    }
  })();
}
/** Include snapshots that could not reach browser storage in portable backups. */
export function recoverySnapshots(): ReadonlyMap<string, SaveEnvelope> {
  return new Map(memory);
}
export function storeRecovery(profileId: number, value: SaveEnvelope): boolean {
  memory.set(key(profileId, value.game), value);
  let durable = true;
  try {
    localStorage.setItem(key(profileId, value.game), JSON.stringify(value));
  } catch {
    durable = false;
  }
  enqueue(profileId, value.game, { kind: "save", value });
  return durable;
}
export async function recoveries(profileId: number): Promise<SaveEnvelope[]> {
  const local = new Map<string, SaveEnvelope>();
  try {
    for (const name of Object.keys(localStorage).filter((k) =>
      k.startsWith(`${prefix}${profileId}:`),
    )) {
      try {
        const slug = name.slice(`${prefix}${profileId}:`.length);
        local.set(
          slug,
          readSave(JSON.parse(localStorage.getItem(name) ?? "null"), slug),
        );
      } catch {
        /* Invalid saves remain exportable. */
      }
    }
  } catch {
    /* Memory-only fallback. */
  }
  for (const [name, value] of memory)
    if (
      name.startsWith(`${prefix}${profileId}:`) &&
      (value.saved_at ?? "") >= (local.get(value.game)?.saved_at ?? "")
    )
      local.set(value.game, value);
  try {
    for (const remote of await progressApi.recovery(profileId)) {
      try {
        const value = readSave(remote.data, remote.game_slug);
        const current = local.get(value.game);
        if (
          !current ||
          (value.saved_at ?? remote.updated_at) > (current.saved_at ?? "")
        )
          local.set(value.game, value);
      } catch {
        /* One unsupported game save must not hide the others. */
      }
    }
  } catch {
    /* Local recovery remains usable during server downtime. */
  }
  return [...local.values()].sort((a, b) =>
    (b.saved_at ?? "").localeCompare(a.saved_at ?? ""),
  );
}
export function clearRecovery(
  profileId: number,
  slug: string,
  sessionId?: string,
): void {
  const id = key(profileId, slug);
  let value = memory.get(id);
  try {
    const stored = JSON.parse(
      localStorage.getItem(id) ?? "null",
    ) as SaveEnvelope | null;
    if (stored && (stored.saved_at ?? "") >= (value?.saved_at ?? ""))
      value = stored;
  } catch {
    /* optional */
  }
  if (!sessionId || value?.session_id === sessionId) {
    memory.delete(id);
    try {
      localStorage.removeItem(id);
    } catch {
      /* optional */
    }
  }
  enqueue(profileId, slug, { kind: "delete", sessionId });
}
