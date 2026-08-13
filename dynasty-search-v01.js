(function () {
  "use strict";

  const input = document.getElementById("dynastySearch");
  const list = document.getElementById("playerValues");
  const status = document.getElementById("dynastySearchStatus");
  if (!input || !list || !status) return;

  function applySearch() {
    const query = input.value.trim().toLocaleLowerCase();
    const cards = [...list.querySelectorAll(".player-card")];
    let visible = 0;

    for (const card of cards) {
      const name = card.querySelector(".pv-name")?.textContent?.trim() || "";
      const matches = !query || name.toLocaleLowerCase().includes(query);
      card.hidden = !matches;
      if (matches) visible += 1;
    }

    let empty = list.querySelector("[data-dynasty-search-empty]");
    if (query && cards.length && visible === 0) {
      if (!empty) {
        empty = document.createElement("p");
        empty.className = "availability-warning";
        empty.dataset.dynastySearchEmpty = "true";
        list.append(empty);
      }
      empty.textContent = `No dynasty players match “${input.value.trim()}”.`;
      empty.hidden = false;
    } else if (empty) {
      empty.hidden = true;
    }

    if (!cards.length) {
      status.textContent = "";
    } else if (query) {
      status.textContent = `${visible} of ${cards.length} currently ranked dynasty players match.`;
    } else {
      status.textContent = `${cards.length} currently ranked dynasty players shown.`;
    }
  }

  input.addEventListener("input", applySearch);

  const observer = new MutationObserver(() => applySearch());
  observer.observe(list, { childList: true });
  applySearch();
})();