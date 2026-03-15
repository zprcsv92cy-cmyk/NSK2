async function checkAppVersion() {
  try {
    const pathParts = location.pathname.split("/").filter(Boolean);
    const isSubPage = pathParts.length > 1;
    const base = isSubPage ? "../" : "./";

    const res = await fetch(base + "deploy.json?ts=" + Date.now(), {
      cache: "no-store"
    });

    if (!res.ok) return;

    const data = await res.json();

    if (!data?.version || !window.NSK_VERSION) return;

    if (String(data.version) !== String(window.NSK_VERSION)) {
      console.warn("Ny version upptäckt:", data.version, "lokal:", window.NSK_VERSION);

      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
      }

      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      location.reload();
    }
  } catch (err) {
    console.warn("Version check failed", err);
  }
}

window.NSK2App = (() => {
  function byId(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (m) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]
    ));
  }

  function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text || "";
  }

  function setHtml(id, html) {
    const el = byId(id);
    if (el) el.innerHTML = html || "";
  }

  function shortName(fullName) {
    const name = String(fullName || "").trim();
    if (!name || name === "—") return name || "";

    const parts = name.split(/\s+/);
    const first = parts[0] || "";
    const lastInitial = parts.length > 1 ? (parts[parts.length - 1][0] + ".") : "";

    return lastInitial ? `${first} ${lastInitial}` : first;
  }

  function normalizeCoachMapName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  const saveTimers = {};
  let truppenRealtime = null;
  let globalClicksBound = false;
  let laguppstallningBound = false;
  let matchCurrentShiftIndex = 0;

  async function init() {
    await checkAppVersion();

    if (window.Auth?.init) {
      try {
        await Auth.init();
      } catch (err) {
        console.warn("Auth init failed", err);
      }
    }

    bindGlobalClicks();

    const pages = [
      initStartsidaPage,
      initSkapaPoolspelPage,
      initLaguppstallningPage,
      initBytesschemaPage,
      initTruppenPage,
      initGoalieStatsPage,
      initLagPage,
      initMatchvyPage
    ];

    for (const fn of pages) {
      try {
        await fn();
      } catch (err) {
        console.warn("Page init failed:", fn.name, err);
        setText("appError", err?.message || String(err));
      }
    }
  }

  function bindGlobalClicks() {
    if (globalClicksBound) return;
    globalClicksBound = true;

    document.addEventListener("click", async (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;

      try {
        if (t.dataset.editPool) {
          sessionStorage.setItem("nsk2_edit_pool_id", t.dataset.editPool);
          window.location.href = "../skapapoolspel/";
          return;
        }

        if (t.dataset.deletePool) {
          const ok = window.confirm("Ta bort poolspelet?");
          if (!ok) return;
          await DB.deletePool(t.dataset.deletePool);
          window.location.reload();
          return;
        }

        if (t.dataset.poolId && t.dataset.lagNo) {
          sessionStorage.setItem("nsk2_pool_id", t.dataset.poolId || "");
          sessionStorage.setItem("nsk2_lag_nr", t.dataset.lagNo || "1");
          window.location.href = "../laguppstallning/";
          return;
        }

        if (t.dataset.poolShifts && t.dataset.lagNo) {
          sessionStorage.setItem("nsk2_pool_id", t.dataset.poolShifts || "");
          sessionStorage.setItem("nsk2_lag_nr", t.dataset.lagNo || "1");
          window.location.href = "../bytesschema/";
          return;
        }

        if (t.dataset.startPoolId) {
          sessionStorage.setItem("nsk2_pool_id", t.dataset.startPoolId || "");
          sessionStorage.setItem("nsk2_match_no", "1");
          window.location.href = "../lag/";
          return;
        }

        if (t.dataset.activeLag && t.dataset.activePool) {
          sessionStorage.setItem("nsk2_pool_id", t.dataset.activePool || "");
          sessionStorage.setItem("nsk2_lag_nr", t.dataset.activeLag || "1");
          sessionStorage.setItem("nsk2_match_no", "1");
          window.location.href = "../matchvy/";
          return;
        }

        if (t.dataset.shiftMatchCard) {
          const sel = byId("shiftMatch");
          if (sel) sel.value = String(t.dataset.shiftMatchCard);
          setActiveShiftMatchButton(String(t.dataset.shiftMatchCard));
          await renderShiftSchema();
          return;
        }

        if (t.dataset.deletePlayer) {
          await deletePlayer(t.dataset.deletePlayer);
          return;
        }

        if (t.dataset.deleteCoach) {
          await deleteCoach(t.dataset.deleteCoach);
          return;
        }

        if (t.dataset.randomGoalie) {
          await randomizeGoalie();
          return;
        }

        if (t.dataset.shiftToggle) {
          await toggleShiftDone(t.dataset.shiftToggle);
          return;
        }
      } catch (err) {
        setText("appError", err.message || String(err));
      }
    });

    document.addEventListener("input", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;

      if (t.dataset.inlinePlayer) {
        queueInlinePlayerSave(t.dataset.inlinePlayer, t.value);
      }
      if (t.dataset.inlineCoach) {
        queueInlineCoachSave(t.dataset.inlineCoach, t.value);
      }
    });

    document.addEventListener("blur", async (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;

      try {
        if (t.dataset.inlinePlayer) {
          await flushInlinePlayerSave(t.dataset.inlinePlayer, t.value);
        }
        if (t.dataset.inlineCoach) {
          await flushInlineCoachSave(t.dataset.inlineCoach, t.value);
        }
      } catch (err) {
        setText("appError", err.message || String(err));
      }
    }, true);
  }

  async function initStartsidaPage() {
    const box = byId("savedPoolsList");
    if (!box) return;

    try {
      const pools = await DB.listPools();

      if (!pools.length) {
        box.innerHTML = '<div class="listrow">Inga sparade poolspel ännu.</div>';
        return;
      }

      box.innerHTML = pools.map((p) => {
        const teams = parseInt(p.teams || "2", 10) || 2;

        const lagButtons = Array.from({ length: teams }, (_, i) => {
          const lagNo = i + 1;
          return `
            <button class="team-btn" type="button" data-pool-id="${p.id}" data-lag-no="${lagNo}">
              Lag ${lagNo}
            </button>
          `;
        }).join("");

        const shiftButtons = Array.from({ length: teams }, (_, i) => {
          const lagNo = i + 1;
          return `
            <button class="team-btn" type="button" data-pool-shifts="${p.id}" data-lag-no="${lagNo}">
              Lag ${lagNo}
            </button>
          `;
        }).join("");

        return `
          <article class="pool-item">
            <div class="pool-top">
              <div>
                <div class="pool-title">${esc(p.place || "Ort")} • ${esc(p.pool_date || "Datum")}</div>
                <div class="pool-meta">${esc(p.title || "Poolspel")}</div>
              </div>
              <div class="status-badge">${esc(p.status || "Aktiv")}</div>
            </div>

            <div class="row-actions pool-actions">
              <button class="row-btn" data-edit-pool="${p.id}">Redigera</button>
              <button class="row-btn danger" data-delete-pool="${p.id}">Ta bort</button>
            </div>

            <div class="pool-lineup-block">
              <div class="pool-lineup-title">Laguppställning</div>
              <div class="team-buttons">${lagButtons}</div>
            </div>

            <div class="pool-lineup-block">
              <div class="pool-lineup-title">Bytesschema</div>
              <div class="team-buttons">${shiftButtons}</div>
            </div>

            <div class="pool-lineup-block">
              <div class="pool-lineup-title">Matchstart för detta poolspel</div>
              <button class="start-pool-btn" type="button" data-start-pool-id="${p.id}">
                Påbörja poolspel • ${esc(p.place || "Ort")} ${esc(p.pool_date || "")}
              </button>
            </div>
          </article>
        `;
      }).join("");
    } catch (err) {
      setText("appError", err.message || String(err));
    }
  }

  async function initSkapaPoolspelPage() {
    const saveBtn = byId("savePool");
    const teamsSel = byId("teams");
    if (!saveBtn || !teamsSel) return;

    const editId = sessionStorage.getItem("nsk2_edit_pool_id");

    if (!editId) {
      if (byId("poolPlace")) byId("poolPlace").value = "";
      if (byId("poolDate")) byId("poolDate").value = "";
    }

    if (editId) {
      try {
        const pool = await DB.getPool(editId);
        if (byId("poolPlace")) byId("poolPlace").value = pool.place || "";
        if (byId("poolDate")) byId("poolDate").value = pool.pool_date || "";
        if (byId("teams")) byId("teams").value = String(pool.teams || 2);
        if (byId("matches")) byId("matches").value = String(pool.matches || 4);
        if (byId("players")) byId("players").value = String(pool.players_on_field || 3);
        if (byId("periods")) byId("periods").value = String(pool.periods || 1);
        if (byId("periodTime")) byId("periodTime").value = String(pool.period_time || 15);
        if (byId("subTime")) byId("subTime").value = String(pool.sub_time || 90);
      } catch (err) {
        setText("appError", err.message || String(err));
      }
    }

    renderLaguppstallningButtons();
    teamsSel.addEventListener("change", () => renderLaguppstallningButtons());
    saveBtn.addEventListener("click", savePool);
  }

  function renderLaguppstallningButtons() {
    const teams = parseInt(byId("teams")?.value || "2", 10);
    const box = byId("lagButtons");
    if (!box) return;

    box.innerHTML = "";
    for (let i = 1; i <= teams; i++) {
      const btn = document.createElement("button");
      btn.className = "team-btn";
      btn.type = "button";
      btn.textContent = `Lag ${i}`;
      btn.addEventListener("click", () => {
        sessionStorage.removeItem("nsk2_pool_id");
        sessionStorage.setItem("nsk2_lag_nr", String(i));
        sessionStorage.setItem("nsk2_lineup_from_create", "1");
        window.location.href = "../laguppstallning/";
      });
      box.appendChild(btn);
    }
  }

  async function savePool() {
    try {
      const payload = {
        title: "Poolspel",
        place: byId("poolPlace")?.value?.trim() || "",
        pool_date: byId("poolDate")?.value || null,
        status: "Aktiv",
        teams: parseInt(byId("teams")?.value || "2", 10),
        matches: parseInt(byId("matches")?.value || "4", 10),
        players_on_field: parseInt(byId("players")?.value || "3", 10),
        periods: parseInt(byId("periods")?.value || "1", 10),
        period_time: parseInt(byId("periodTime")?.value || "15", 10),
        sub_time: parseInt(byId("subTime")?.value || "90", 10)
      };

      const editId = sessionStorage.getItem("nsk2_edit_pool_id");
      if (editId) {
        await DB.updatePool(editId, payload);
        sessionStorage.removeItem("nsk2_edit_pool_id");
      } else {
        const pool = await DB.addPool(payload);
        sessionStorage.setItem("nsk2_pool_id", pool.id);
      }

      setText("poolMsg", "Poolspel sparat");
      window.location.href = "../startsida/";
    } catch (err) {
      setText("appError", err.message || String(err));
    }
  }

  async function initLaguppstallningPage() {}
  async function initBytesschemaPage() {}
  async function initGoalieStatsPage() {}
  async function initLagPage() {}
  async function initMatchvyPage() {}

  async function importPlayersAndCoachesFromJsonObject(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Ogiltig backupfil.");
    }

    const players = Array.isArray(data.players) ? data.players : [];
    const coaches = Array.isArray(data.coaches) ? data.coaches : [];

    const existingPlayers = typeof DB?.listPlayers === "function"
      ? await DB.listPlayers()
      : [];
    const existingCoaches = typeof DB?.listCoaches === "function"
      ? await DB.listCoaches()
      : [];

    const existingPlayerNames = new Set(
      existingPlayers.map(p => String(p.full_name || "").trim().toLowerCase()).filter(Boolean)
    );
    const existingCoachNames = new Set(
      existingCoaches.map(c => String(c.full_name || "").trim().toLowerCase()).filter(Boolean)
    );

    let addedPlayers = 0;
    let addedCoaches = 0;
    let skippedPlayers = 0;
    let skippedCoaches = 0;

    for (const name of players) {
      const safeName = String(name || "").trim();
      const key = safeName.toLowerCase();
      if (!safeName) continue;

      if (existingPlayerNames.has(key)) {
        skippedPlayers++;
        continue;
      }

      if (typeof DB?.addPlayer !== "function") {
        throw new Error("DB.addPlayer saknas.");
      }

      await DB.addPlayer(safeName);
      existingPlayerNames.add(key);
      addedPlayers++;
    }

    for (const name of coaches) {
      const safeName = String(name || "").trim();
      const key = safeName.toLowerCase();
      if (!safeName) continue;

      if (existingCoachNames.has(key)) {
        skippedCoaches++;
        continue;
      }

      if (typeof DB?.addCoach !== "function") {
        throw new Error("DB.addCoach saknas.");
      }

      await DB.addCoach(safeName);
      existingCoachNames.add(key);
      addedCoaches++;
    }

    if (typeof DB?.listPlayers === "function") await renderPlayers();
    if (typeof DB?.listCoaches === "function") await renderCoaches();

    setText(
      "truppenMsg",
      `Import klar. Spelare: +${addedPlayers} (${skippedPlayers} fanns redan). Tränare: +${addedCoaches} (${skippedCoaches} fanns redan).`
    );
  }

  async function handleImportBackupFile(file) {
    if (!file) return;

    try {
      setText("truppenMsg", "Importerar backup...");
      const text = await file.text();
      const data = JSON.parse(text);
      await importPlayersAndCoachesFromJsonObject(data);
    } catch (err) {
      setText("truppenMsg", err?.message || String(err));
      setText("appError", err?.message || String(err));
    }
  }

  function rowHtml(item, type) {
    return `
      <div class="person-row">
        <div class="person-main">
          <input class="inline-name-input" value="${esc(item.full_name)}" data-inline-${type}="${item.id}">
        </div>
        <div class="row-actions">
          <button class="row-btn danger" data-delete-${type}="${item.id}">Ta bort</button>
        </div>
      </div>
    `;
  }

  async function renderPlayers() {
    const list = byId("playersList");
    if (!list) return;
    const players = await DB.listPlayers();
    list.innerHTML = players.length
      ? players.map((p) => rowHtml(p, "player")).join("")
      : '<div class="muted-note">Inga spelare ännu.</div>';
  }

  async function renderCoaches() {
    const list = byId("coachesList");
    if (!list) return;
    const coaches = await DB.listCoaches();
    list.innerHTML = coaches.length
      ? coaches.map((c) => rowHtml(c, "coach")).join("")
      : '<div class="muted-note">Inga tränare ännu.</div>';
  }

  function queueInlinePlayerSave(id, value) {
    clearTimeout(saveTimers[`p_${id}`]);
    saveTimers[`p_${id}`] = setTimeout(async () => {
      await DB.updatePlayer(id, String(value || "").trim());
    }, 600);
  }

  function queueInlineCoachSave(id, value) {
    clearTimeout(saveTimers[`c_${id}`]);
    saveTimers[`c_${id}`] = setTimeout(async () => {
      await DB.updateCoach(id, String(value || "").trim());
    }, 600);
  }

  async function flushInlinePlayerSave(id, value) {
    clearTimeout(saveTimers[`p_${id}`]);
    await DB.updatePlayer(id, String(value || "").trim());
  }

  async function flushInlineCoachSave(id, value) {
    clearTimeout(saveTimers[`c_${id}`]);
    await DB.updateCoach(id, String(value || "").trim());
  }

  async function addPlayer() {
    const input = byId("playerInput");
    const name = input?.value?.trim();
    if (!name) return;
    await DB.addPlayer(name);
    input.value = "";
    await renderPlayers();
  }

  async function addCoach() {
    const input = byId("coachInput");
    const name = input?.value?.trim();
    if (!name) return;
    await DB.addCoach(name);
    input.value = "";
    await renderCoaches();
  }

  async function deletePlayer(id) {
    await DB.deletePlayer(id);
    await renderPlayers();
  }

  async function deleteCoach(id) {
    await DB.deleteCoach(id);
    await renderCoaches();
  }

  async function initTruppenPage() {
    if (!byId("playersList") && !byId("coachesList")) return;

    byId("addPlayerBtn")?.addEventListener("click", addPlayer);
    byId("addCoachBtn")?.addEventListener("click", addCoach);

    const importBtn = byId("importBackupBtn");
    const importInput = byId("importBackupFile");

    if (importBtn && importInput && !importBtn.dataset.bound) {
      importBtn.dataset.bound = "1";
      importBtn.addEventListener("click", () => importInput.click());
      importInput.addEventListener("change", async (e) => {
        const file = e.target?.files?.[0];
        await handleImportBackupFile(file);
        importInput.value = "";
      });
    }

    await renderPlayers();
    await renderCoaches();

    if (!truppenRealtime && typeof DB?.subscribeTruppen === "function") {
      truppenRealtime = await DB.subscribeTruppen(async (type) => {
        if (type === "players") await renderPlayers();
        if (type === "coaches") await renderCoaches();
      });
    }
  }

  return { init };
})();

window.addEventListener("DOMContentLoaded", () => {
  window.NSK2App.init().catch((err) => {
    const el = document.getElementById("appError");
    if (el) el.textContent = err.message || String(err);
    console.error(err);
  });
});
