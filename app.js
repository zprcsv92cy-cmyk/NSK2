window.NSK2App = (() => {
  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    }[m]));
  }
  function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text || "";
  }

  let players = [];
  let coaches = [];
  let truppenRealtime = null;
  let truppenBound = false;

  async function init() {
    if (window.Auth?.init) await Auth.init();
    await initTruppenPage();
  }

  function rowHtml(item, type) {
    return `
      <div class="swipe-wrap">
        <button class="swipe-delete-btn" data-delete-${type}="${item.id}">Ta bort</button>
        <div class="person-row draggable-row" draggable="true" data-id="${item.id}" data-type="${type}">
          <div class="drag-handle">☰</div>
          <div class="person-main">
            <input class="inline-name-input" value="${esc(item.full_name)}" data-inline-${type}="${item.id}">
          </div>
          <div class="row-actions">
            <button class="row-btn" data-save-${type}="${item.id}">Spara</button>
            <button class="row-btn danger desktop-delete" data-delete-${type}="${item.id}">Ta bort</button>
          </div>
        </div>
      </div>
    `;
  }

  async function renderPlayers() {
    const list = byId("playersList");
    if (!list) return;
    players = await DB.listPlayers();
    list.innerHTML = players.length ? players.map(p => rowHtml(p, "player")).join("") : '<div class="muted-note">Inga spelare ännu.</div>';
    bindSwipe(list);
    bindDrag(list, "player");
  }

  async function renderCoaches() {
    const list = byId("coachesList");
    if (!list) return;
    coaches = await DB.listCoaches();
    list.innerHTML = coaches.length ? coaches.map(c => rowHtml(c, "coach")).join("") : '<div class="muted-note">Inga tränare ännu.</div>';
    bindSwipe(list);
    bindDrag(list, "coach");
  }

  async function addPlayer() {
    const input = byId("playerInput");
    const name = input?.value?.trim();
    if (!name) return setText("playersMsg", "Skriv ett namn.");
    await DB.addPlayer(name);
    input.value = "";
    setText("playersMsg", "Spelare sparad.");
    await renderPlayers();
  }

  async function addCoach() {
    const input = byId("coachInput");
    const name = input?.value?.trim();
    if (!name) return setText("coachesMsg", "Skriv ett namn.");
    await DB.addCoach(name);
    input.value = "";
    setText("coachesMsg", "Tränare sparad.");
    await renderCoaches();
  }

  function inlineValue(type, id) {
    const el = document.querySelector(`[data-inline-${type}="${id}"]`);
    return el ? el.value.trim() : "";
  }

  async function saveInlinePlayer(id) {
    const next = inlineValue("player", id);
    if (!next) return;
    await DB.updatePlayer(id, next);
    setText("playersMsg", "Spelare uppdaterad.");
    await renderPlayers();
  }

  async function saveInlineCoach(id) {
    const next = inlineValue("coach", id);
    if (!next) return;
    await DB.updateCoach(id, next);
    setText("coachesMsg", "Tränare uppdaterad.");
    await renderCoaches();
  }

  async function deletePlayer(id) {
    await DB.deletePlayer(id);
    setText("playersMsg", "Spelare borttagen.");
    await renderPlayers();
  }

  async function deleteCoach(id) {
    await DB.deleteCoach(id);
    setText("coachesMsg", "Tränare borttagen.");
    await renderCoaches();
  }

  function bindSwipe(root) {
    root.querySelectorAll(".person-row").forEach(row => {
      let startX = 0;
      let currentX = 0;
      let dragging = false;
      const wrap = row.parentElement;

      row.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
        currentX = startX;
        dragging = true;
      }, { passive: true });

      row.addEventListener("touchmove", e => {
        if (!dragging) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        if (diff < -40) wrap.classList.add("swiped");
        if (diff > 30) wrap.classList.remove("swiped");
      }, { passive: true });

      row.addEventListener("touchend", () => {
        dragging = false;
      });
    });
  }

  function bindDrag(root, type) {
    const rows = Array.from(root.querySelectorAll(".draggable-row"));

    rows.forEach(row => {
      row.addEventListener("dragstart", () => {
        row.classList.add("dragging");
      });

      row.addEventListener("dragend", async () => {
        row.classList.remove("dragging");
        const ids = Array.from(root.querySelectorAll(".draggable-row")).map(r => r.dataset.id);
        try {
          if (type === "player") await DB.savePlayerOrder(ids);
          if (type === "coach") await DB.saveCoachOrder(ids);
        } catch (err) {
          setText("appError", err.message || String(err));
        }
      });
    });

    root.addEventListener("dragover", e => {
      e.preventDefault();
      const after = getDragAfterElement(root, e.clientY);
      const dragging = root.querySelector(".dragging");
      if (!dragging) return;
      const wrap = dragging.parentElement;
      if (after == null) {
        root.appendChild(wrap);
      } else {
        root.insertBefore(wrap, after.parentElement);
      }
    });
  }

  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll(".draggable-row:not(.dragging)")];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  async function initTruppenPage() {
    if (!byId("playersList") && !byId("coachesList")) return;

    if (!truppenBound) {
      truppenBound = true;

      byId("addPlayerBtn")?.addEventListener("click", addPlayer);
      byId("addCoachBtn")?.addEventListener("click", addCoach);

      document.addEventListener("keydown", async e => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement)) return;
        if (e.key !== "Enter") return;
        try {
          if (t.dataset.inlinePlayer) await saveInlinePlayer(t.dataset.inlinePlayer);
          if (t.dataset.inlineCoach) await saveInlineCoach(t.dataset.inlineCoach);
        } catch (err) {
          setText("appError", err.message || String(err));
        }
      });

      document.addEventListener("click", async e => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        try {
          if (t.dataset.savePlayer) await saveInlinePlayer(t.dataset.savePlayer);
          if (t.dataset.saveCoach) await saveInlineCoach(t.dataset.saveCoach);
          if (t.dataset.deletePlayer) await deletePlayer(t.dataset.deletePlayer);
          if (t.dataset.deleteCoach) await deleteCoach(t.dataset.deleteCoach);
        } catch (err) {
          setText("appError", err.message || String(err));
        }
      });
    }

    await renderPlayers();
    await renderCoaches();

    if (!truppenRealtime) {
      truppenRealtime = await DB.subscribeTruppen(async type => {
        if (type === "players") await renderPlayers();
        if (type === "coaches") await renderCoaches();
      });
    }
  }

  return { init };
})();

window.addEventListener("DOMContentLoaded", () => {
  window.NSK2App.init().catch(err => {
    const el = document.getElementById("appError");
    if (el) el.textContent = err.message || String(err);
    console.error(err);
  });
});
