// app.js — NSK Team 18 full file
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
  let truppenBound = false;
  let truppenRealtime = null;
  let poolConfigBound = false;
  let poolConfigRealtime = null;
  let poolConfigLoading = false;
  let poolConfigTimer = null;

  async function init() {
    if (window.Auth?.init) await Auth.init();

    await initTruppenPage();
    await initSkapaPoolspelPage();
    await initGoalieStatsPage();
  }

  // -----------------------
  // TRUPPEN
  // -----------------------
  function truppenRowHtml(item, type) {
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
    if (!byId("playersList")) return;
    players = await DB.listPlayers();
    byId("playersList").innerHTML = players.length
      ? players.map(p => truppenRowHtml(p, "player")).join("")
      : '<div class="muted-note">Inga spelare ännu.</div>';
    bindSwipe(byId("playersList"));
    bindDrag(byId("playersList"), "player");
  }

  async function renderCoaches() {
    if (!byId("coachesList")) return;
    coaches = await DB.listCoaches();
    byId("coachesList").innerHTML = coaches.length
      ? coaches.map(c => truppenRowHtml(c, "coach")).join("")
      : '<div class="muted-note">Inga tränare ännu.</div>';
    bindSwipe(byId("coachesList"));
    bindDrag(byId("coachesList"), "coach");
  }

  async function addPlayer() {
    const input = byId("playerInput");
    const name = input?.value?.trim();
    if (!name) return setText("playersMsg", "Skriv ett namn.");
    await DB.addPlayer(name);
    input.value = "";
    setText("playersMsg", "Spelare sparad.");
    await renderPlayers();
    await fillPlayerDropdowns();
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
    await fillPlayerDropdowns();
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
    await fillPlayerDropdowns();
  }

  async function deleteCoach(id) {
    await DB.deleteCoach(id);
    setText("coachesMsg", "Tränare borttagen.");
    await renderCoaches();
  }

  function bindSwipe(root) {
    if (!root) return;
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
    if (!root) return;
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
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
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
        if (type === "players") {
          await renderPlayers();
          await fillPlayerDropdowns();
        }
        if (type === "coaches") await renderCoaches();
      });
    }
  }

  // -----------------------
  // SKAPA POOLSPEL
  // -----------------------
  async function savePool() {
    const title = byId("poolName")?.value?.trim();
    const place = byId("poolPlace")?.value?.trim();
    const pool_date = byId("poolDate")?.value || null;

    if (!title) return setText("poolMsg", "Skriv namn på poolspelet.");

    const row = await DB.addPool({ title, place, pool_date, status: "Aktiv" });
    sessionStorage.setItem("nsk2_current_pool_id", row.id);
    setText("poolMsg", "Poolspel sparat.");
    await loadPoolsList();
  }

  async function loadPoolsList() {
    const el = byId("poolPageList");
    if (!el) return;
    const pools = await DB.listPools();
    el.innerHTML = pools.length
      ? pools.map(p => `
        <div class="listrow">
          <strong>${esc(p.title)}</strong> – ${esc(p.place || "")} – ${esc(p.pool_date || "")}
          <button class="row-btn" data-open-pool="${p.id}">Öppna</button>
        </div>
      `).join("")
      : '<div class="listrow">Inga poolspel ännu.</div>';
  }

  async function fillPlayerDropdowns() {
    const ids = ["matchPlayer1","matchPlayer2","matchPlayer3","matchPlayer4","matchPlayer5","matchGoalie"];
    if (!ids.some(id => byId(id))) return;

    const list = await DB.listPlayers();
    ids.forEach(id => {
      const el = byId(id);
      if (!el) return;
      const current = el.value || "";
      el.innerHTML = '<option value="">Välj...</option>' + list.map(p => {
        const name = String(p.full_name || "");
        const safe = name.replace(/"/g, "&quot;");
        return `<option value="${safe}">${name}</option>`;
      }).join("");
      if (current) el.value = current;
    });
  }

  function getSelectedConfig() {
    return {
      team_no: byId("cfgTeamNo")?.value || "1",
      matches_total: byId("cfgMatchesTotal")?.value || "1",
      match_no: byId("cfgMatchNo")?.value || "1",
      start_time: byId("cfgStartTime")?.value || null,
      opponent: byId("cfgOpponent")?.value || null,
      field: byId("cfgField")?.value || null,
      players_total: byId("cfgPlayersTotal")?.value || null,
      players_on_field: byId("cfgPlayersOnField")?.value || null,
      periods: byId("cfgPeriods")?.value || null,
      period_minutes: byId("cfgPeriodMinutes")?.value || null,
      shift_seconds: byId("cfgShiftSeconds")?.value || null,
      player_1: byId("matchPlayer1")?.value || null,
      player_2: byId("matchPlayer2")?.value || null,
      player_3: byId("matchPlayer3")?.value || null,
      player_4: byId("matchPlayer4")?.value || null,
      player_5: byId("matchPlayer5")?.value || null,
      goalie_name: byId("matchGoalie")?.value || null
    };
  }

  function setValue(id, value) {
    const el = byId(id);
    if (el) el.value = value ?? "";
  }

  async function loadSelectedConfig() {
    const teamNo = byId("cfgTeamNo")?.value || "1";
    const matchNo = byId("cfgMatchNo")?.value || "1";
    poolConfigLoading = true;
    try {
      const row = await DB.getMatchConfig(teamNo, matchNo);
      if (row) {
        setValue("cfgMatchesTotal", row.matches_total);
        setValue("cfgStartTime", row.start_time);
        setValue("cfgOpponent", row.opponent);
        setValue("cfgField", row.field);
        setValue("cfgPlayersTotal", row.players_total);
        setValue("cfgPlayersOnField", row.players_on_field);
        setValue("cfgPeriods", row.periods);
        setValue("cfgPeriodMinutes", row.period_minutes);
        setValue("cfgShiftSeconds", row.shift_seconds);
        setValue("matchPlayer1", row.player_1);
        setValue("matchPlayer2", row.player_2);
        setValue("matchPlayer3", row.player_3);
        setValue("matchPlayer4", row.player_4);
        setValue("matchPlayer5", row.player_5);
        setValue("matchGoalie", row.goalie_name);
        setText("poolConfigMsg", "Laddad från Supabase.");
      } else {
        setText("poolConfigMsg", "Ny konfiguration.");
      }
    } catch (err) {
      setText("appError", err.message || String(err));
    } finally {
      poolConfigLoading = false;
    }
  }

  async function saveSelectedConfig() {
    if (poolConfigLoading) return;
    try {
      await DB.upsertMatchConfig(getSelectedConfig());
      setText("poolConfigMsg", "Autosparat i Supabase.");
    } catch (err) {
      setText("appError", err.message || String(err));
    }
  }

  function queueConfigSave() {
    if (poolConfigLoading) return;
    clearTimeout(poolConfigTimer);
    poolConfigTimer = setTimeout(saveSelectedConfig, 400);
  }

  async function initSkapaPoolspelPage() {
    if (!byId("cfgTeamNo") && !byId("savePoolBtn")) return;

    byId("savePoolBtn")?.addEventListener("click", savePool);
    await loadPoolsList();
    await fillPlayerDropdowns();

    if (!byId("cfgTeamNo")) return;
    if (!poolConfigBound) {
      poolConfigBound = true;
      const ids = [
        "cfgTeamNo","cfgMatchesTotal","cfgMatchNo","cfgStartTime","cfgOpponent","cfgField",
        "cfgPlayersTotal","cfgPlayersOnField","cfgPeriods","cfgPeriodMinutes","cfgShiftSeconds",
        "matchPlayer1","matchPlayer2","matchPlayer3","matchPlayer4","matchPlayer5","matchGoalie"
      ];

      ids.forEach(id => {
        const el = byId(id);
        if (!el) return;
        const eventName = (el.tagName === "INPUT" && el.type === "text") ? "input" : "change";
        el.addEventListener(eventName, async () => {
          if (id === "cfgTeamNo" || id === "cfgMatchNo") {
            await loadSelectedConfig();
          } else {
            queueConfigSave();
          }
        });
      });

      byId("saveMatchConfigBtn")?.addEventListener("click", saveSelectedConfig);

      document.addEventListener("click", async e => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.dataset.openPool) {
          sessionStorage.setItem("nsk2_current_pool_id", t.dataset.openPool);
          await loadSelectedConfig();
          setText("poolMsg", "Poolspel öppnat.");
        }
      });
    }

    await loadSelectedConfig();

    if (!poolConfigRealtime) {
      poolConfigRealtime = await DB.subscribeMatchConfigs(async () => {
        await fillPlayerDropdowns();
        await loadSelectedConfig();
      });
    }
  }

  // -----------------------
  // MÅLVAKTSSTATISTIK
  // -----------------------
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
        .map(([name, set]) => ({ name, matches: set.size }))
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
