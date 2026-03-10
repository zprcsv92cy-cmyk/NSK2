window.NSK2App = (() => {
  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  }
  function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text || "";
  }

  let players = [];
  let coaches = [];
  let truppenRealtime = null;
  let truppenBound = false;
  let startsidaPoolsLoaded = false;

  async function init() {
    if (window.Auth?.init) await Auth.init();
    await initStartsidaPage();
    await initTruppenPage();
    await initGoalieStatsPage();
  }

  async function initStartsidaPage() {
    const savedPoolsList = byId("savedPoolsList");
    if (!savedPoolsList || startsidaPoolsLoaded) return;
    startsidaPoolsLoaded = true;

    try {
      const pools = await DB.listPools();
      savedPoolsList.innerHTML = pools.length
        ? pools.map(p => `
          <article class="pool-item">
            <div class="pool-top">
              <div>
                <div class="pool-title">${esc(p.pool_date || "Utan datum")} • ${esc(p.place || "Utan plats")}</div>
                <div class="pool-meta">${esc(p.title || "Poolspel")}</div>
              </div>
              <div class="status-badge">${esc(p.status || "Aktiv")}</div>
            </div>
          </article>
        `).join("")
        : '<div class="listrow">Inga sparade poolspel ännu.</div>';
    } catch (err) {
      setText("appError", err.message || String(err));
    }
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
    if (window.innerWidth <= 700) return;
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
      if (after == null) root.appendChild(wrap);
      else root.insertBefore(wrap, after.parentElement);
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

  async function initGoalieStatsPage() {
    const list = byId("goalieStatsList");
    if (!list) return;

    try {
      const stats = await DB.listGoalieStats();
      const grouped = {};
      stats.forEach(row => {
        const name = (row.goalie_name || "").trim() || "Okänd målvakt";
        if (!grouped[name]) grouped[name] = new Set();
        if (row.match_id) grouped[name].add(row.match_id);
      });

      const rows = Object.entries(grouped)
        .map(([name, matches]) => ({ name, matches: matches.size }))
        .sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name, "sv"));

      list.innerHTML = rows.length
        ? rows.map(r => `<div class="listrow"><strong>${esc(r.name)}</strong> — ${r.matches} ${r.matches === 1 ? "match" : "matcher"}</div>`).join("")
        : '<div class="listrow">Ingen målvaktsstatistik ännu.</div>';
    } catch (err) {
      setText("appError", err.message || String(err));
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
async function savePoolConfig(){

const payload = {

pool_date: document.getElementById("poolDate").value,
place: document.getElementById("poolPlace").value,

teams: parseInt(document.getElementById("teams").value),
matches: parseInt(document.getElementById("matches").value),

players_on_field: parseInt(document.getElementById("players").value),
periods: parseInt(document.getElementById("periods").value),

period_time: parseInt(document.getElementById("periodTime").value),
sub_time: parseInt(document.getElementById("subTime").value)

}

await DB.addPool(payload)

alert("Poolspel sparat")

}
function generateTeamButtons(){

const teams = parseInt(document.getElementById("teams").value)

const container = document.getElementById("teamButtons")

container.innerHTML = ""

for(let i=1;i<=teams;i++){

const btn = document.createElement("button")

btn.textContent = "Lag " + i

btn.className = "team-btn"

container.appendChild(btn)

}

}

document.getElementById("teams")?.addEventListener("change",generateTeamButtons)
async function savePoolspelPage() {
  const place = document.getElementById("poolPlace")?.value?.trim() || "";
  const pool_date = document.getElementById("poolDate")?.value || null;
  const teams = parseInt(document.getElementById("teams")?.value || "2", 10);
  const matches = parseInt(document.getElementById("matches")?.value || "4", 10);
  const players = parseInt(document.getElementById("players")?.value || "3", 10);
  const periods = parseInt(document.getElementById("periods")?.value || "1", 10);
  const periodTime = parseInt(document.getElementById("periodTime")?.value || "15", 10);
  const subTime = parseInt(document.getElementById("subTime")?.value || "90", 10);

  try {
    const row = await DB.addPool({
      title: "Poolspel",
      place,
      pool_date,
      status: "Aktiv",
      teams,
      matches,
      players_on_field: players,
      periods,
      period_time: periodTime,
      sub_time: subTime
    });

    const msg = document.getElementById("poolMsg");
    if (msg) msg.textContent = "Poolspel sparat.";

    if (row?.id) {
      sessionStorage.setItem("nsk2_current_pool_id", row.id);
    }
  } catch (err) {
    const errBox = document.getElementById("appError");
    if (errBox) errBox.textContent = err.message || String(err);
  }
}

function renderTeamButtons() {
  const teams = parseInt(document.getElementById("teams")?.value || "2", 10);
  const box = document.getElementById("teamButtons");
  if (!box) return;

  box.innerHTML = "";

  for (let i = 1; i <= teams; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "team-btn";
    btn.textContent = `Lag ${i}`;
    btn.dataset.teamNo = String(i);
    box.appendChild(btn);
  }
}

function initSkapaPoolspelPage() {
  const saveBtn = document.getElementById("savePool");
  const teamsSel = document.getElementById("teams");
  if (!saveBtn || !teamsSel) return;

  renderTeamButtons();
  teamsSel.addEventListener("change", renderTeamButtons);
  saveBtn.addEventListener("click", savePoolspelPage);
}