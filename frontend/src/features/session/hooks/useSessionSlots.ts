import { useRef, useState, type RefObject } from "react";
import { savesApi, type SaveData } from "../../../api/client";
import type { SaveEnvelope } from "../../../shared/persistence/saves";
import type { SessionPhase } from "../services/lifecycle";
import type { ConfirmationRequest } from "../../../shared/ui/Confirmation";
import type { ToastType } from "../../../shared/ui/useToast";
export function useSessionSlots({
  slug,
  title,
  phase,
  profile,
  snapshot,
  act,
  ask,
  onPhase,
  notify,
  restore,
}: {
  slug: string;
  title: string;
  phase: SessionPhase;
  profile: RefObject<number | null>;
  snapshot: () => SaveEnvelope;
  act: (fn: () => Promise<void>) => Promise<void>;
  ask: (request: ConfirmationRequest) => Promise<boolean>;
  onPhase: (state: SessionPhase) => void;
  notify: (message: string, type?: ToastType) => void;
  restore: (value: unknown) => Promise<void>;
}) {
  const [saves, setSaves] = useState<SaveData[]>([]);
  const origin = useRef<SessionPhase>("paused");
  const openSaves = (mode: "save" | "load") =>
    act(async () => {
      origin.current = phase;
      const data = await savesApi.list(slug, profile.current ?? undefined);
      setSaves(data.saves);
      onPhase(mode);
    });
  const saveSlot = (slot: number) =>
    act(async () => {
      if (
        saves.some((s) => s.slot === slot) &&
        !(await ask({
          title: `Replace slot ${slot}?`,
          message:
            "The previous save in this slot will be replaced. Your recovery save and other slots are kept.",
          confirmText: "Replace save",
        }))
      )
        return;
      const data = snapshot();
      await savesApi.create(
        slug,
        slot,
        data,
        `${title} · ${new Date().toLocaleString()}`,
        profile.current ?? undefined,
      );
      setSaves((await savesApi.list(slug, profile.current ?? undefined)).saves);
      notify(`Saved to slot ${slot}`, "success");
    });
  const deleteSlot = (slot: number) =>
    act(async () => {
      if (
        !(await ask({
          title: `Delete slot ${slot}?`,
          message:
            "This saved run will be permanently removed. Other slots and recorded scores are kept.",
          confirmText: "Delete save",
        }))
      )
        return;
      await savesApi.delete(slug, slot, profile.current ?? undefined);
      setSaves((await savesApi.list(slug, profile.current ?? undefined)).saves);
    });
  const closeSlots = () => onPhase(origin.current);
  const loadSlot = (slot: number) =>
    act(() => restore(saves.find((save) => save.slot === slot)?.data));
  return {
    saves,
    commands: { openSaves, saveSlot, loadSlot, deleteSlot, closeSlots },
  };
}
