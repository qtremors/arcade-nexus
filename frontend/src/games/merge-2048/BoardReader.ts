import { PUZZLES } from "./puzzles";
import type { Merge2048View } from "./Merge2048Simulation";
/** Semantic controls and announcements share the same live board as the canvas. */
export class BoardReader {
  private reader: HTMLDetailsElement | null = null;
  private revision = -1;
  private direction: (value: "left" | "right" | "up" | "down") => void;
  private undo: () => void;
  constructor(
    direction: (value: "left" | "right" | "up" | "down") => void,
    undo: () => void,
  ) {
    this.direction = direction;
    this.undo = undo;
  }
  mount(canvas: HTMLCanvasElement): void {
    this.reader = document.createElement("details");
    this.reader.className = "puzzle-reader";
    // Preserve native Space/Enter activation for the semantic controls.
    this.reader.addEventListener("keydown", (event) => {
      if (
        (event.code === "Space" || event.code === "Enter") &&
        event.target instanceof HTMLElement &&
        event.target.closest("button, summary")
      )
        event.stopPropagation();
    });
    this.reader.innerHTML = `<summary>Board reader & move explanations</summary><p class="puzzle-objective"></p><table aria-label="2048 board"><caption>Rows from top to bottom; empty cells say empty</caption><tbody></tbody></table><div class="puzzle-buttons"></div><p class="puzzle-explanation" role="status" aria-live="polite" aria-atomic="true"></p>`;
    for (const direction of ["left", "up", "down", "right"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `Slide ${direction}`;
      button.onclick = () => {
        this.direction(direction);
      };
      this.reader.querySelector(".puzzle-buttons")!.appendChild(button);
    }
    const undo = document.createElement("button");
    undo.type = "button";
    undo.textContent = "Undo move";
    undo.dataset.undo = "true";
    undo.onclick = () => {
      this.undo();
    };
    this.reader.querySelector(".puzzle-buttons")!.appendChild(undo);
    canvas.parentElement?.appendChild(this.reader);
  }
  sync(view: Merge2048View): void {
    if (this.revision === view.revision) return;
    this.revision = view.revision;
    if (!this.reader) return;
    const body = this.reader.querySelector("tbody")!;
    body.replaceChildren();
    for (let row = 0; row < 4; row++) {
      const tr = document.createElement("tr");
      for (let col = 0; col < 4; col++) {
        const td = document.createElement("td");
        const value = view.board[row * 4 + col] || "empty";
        td.textContent = String(value);
        td.setAttribute(
          "aria-label",
          `Row ${row + 1}, column ${col + 1}: ${value}`,
        );
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    this.reader.querySelector(".puzzle-objective")!.textContent =
      view.puzzleMode
        ? `${PUZZLES[view.puzzle].name}. Make ${view.goal} in ${PUZZLES[view.puzzle].moves} moves. ${view.moves} moves used. No new tiles spawn.`
        : "Merge equal tiles to reach 2048. One undo is available in relaxed mode.";
    this.reader.querySelector(".puzzle-explanation")!.textContent =
      view.explanation;
    (this.reader.querySelector("[data-undo]") as HTMLButtonElement).disabled =
      !view.undo;
  }

  destroy() {
    this.reader?.remove();
    this.reader = null;
    this.revision = -1;
  }
}
