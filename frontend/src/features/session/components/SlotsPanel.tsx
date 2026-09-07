import type { SessionUi } from "../hooks/useGameSession";
import { menuButton } from "./menuButton";
export function SlotsPanel({
  session,
}: {
  slug: string;
  title: string;
  session: SessionUi;
}) {
  const { state, saves } = session.view;
  const { saveSlot, loadSlot, deleteSlot, closeSlots } = session.commands;
  const button = menuButton(session.view.busy);
  return (
    <>
      <div className="save-slots">
        {[1, 2, 3, 4, 5].map((slot) => {
          const entry = saves.find((s) => s.slot === slot);
          return (
            <div key={slot}>
              {button(
                `Slot ${slot} · ${entry ? entry.name || "Saved run" : "Empty"}`,
                () => void (state === "save" ? saveSlot(slot) : loadSlot(slot)),
                state === "load" && !entry,
              )}
              {entry &&
                button(`Delete slot ${slot}`, () => void deleteSlot(slot))}
            </div>
          );
        })}
      </div>
      {button("Back", closeSlots)}
    </>
  );
}
