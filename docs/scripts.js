const filters = [...document.querySelectorAll("[data-filter]")];
const games = [...document.querySelectorAll("[data-category]")];
const count = document.querySelector("#game-count");

for (const button of filters) {
  button.addEventListener("click", () => {
    const category = button.dataset.filter;
    for (const filter of filters) {
      const active = filter === button;
      filter.classList.toggle("active", active);
      filter.setAttribute("aria-pressed", String(active));
    }
    for (const game of games) {
      game.hidden = category !== "all" && game.dataset.category !== category;
    }
    const visible = games.filter((game) => !game.hidden).length;
    count.textContent = `${visible} ${visible === 1 ? "game" : "games"} in the arcade`;
  });
}

document.querySelector("#copy-command").addEventListener("click", async () => {
  const status = document.querySelector("#copy-status");
  try {
    await navigator.clipboard.writeText("python arcade.py --setup");
    status.textContent = "Setup command copied.";
  } catch {
    status.textContent = "Select and copy: python arcade.py --setup";
  }
});
