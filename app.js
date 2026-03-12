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

  const saveTimers = {};
  let truppenRealtime = null;
  let globalClicksBound = false;
  let laguppstallningBound = false;

  async function init() {
    if (window.Auth?.init) await Auth.init();

    bindGlobalClicks();

    await initStartsidaPage();
    await initSkapaPoolspelPage();
    await initLaguppstallningPage();
    await initBytesschemaPage();
    await initTruppenPage();
    await initGoalieStatsPage();
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

  async function initLaguppstallningPage() {
    const teamButtonsBox = byId("laguppstallningTeamButtons");
    const matchSelect = byId("lineupMatch");
    const lineupBox = byId("lineupSelectors");
    const coachSelect = byId("lineupCoach");

    if (!teamButtonsBox || !matchSelect || !lineupBox || !coachSelect) return;

    try {
      const poolId = sessionStorage.getItem("nsk2_pool_id");
      let teams = 2;
      let matches = 4;
      let playersOnField = 3;

      if (poolId) {
        const pool = await DB.getPool(poolId);
        teams = parseInt(pool?.teams || "2", 10) || 2;
        matches = parseInt(pool?.matches || "4", 10) || 4;
        playersOnField = parseInt(pool?.players_on_field || "3", 10) || 3;
      }

      renderLaguppstallningTeamButtons(teams);
      renderLaguppstallningMatchOptions(matches);
      renderMatchButtons(matches);
      renderPlayerCountOptions(playersOnField);
      await renderCoachOptions();
      await renderLineupSelectors();

      const savedLag = sessionStorage.getItem("nsk2_lag_nr") || "1";
      setActiveLagButton(savedLag);
      const currentMatch = byId("lineupMatch")?.value || "1";
      setActiveMatchButton(currentMatch);

      if (!laguppstallningBound) {
        laguppstallningBound = true;
      }

      updateVisiblePlayers();
      attachLineupHandlers();
      updateCoachEnabledState();
      await fillLaguppstallningFormFromSelection();
    } catch (err) {
      setText("appError", err.message || String(err));
    }
  }

  function renderLaguppstallningTeamButtons(teams) {
    const box = byId("laguppstallningTeamButtons");
    if (!box) return;
    box.innerHTML = "";

    for (let i = 1; i <= teams; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "team-btn lag-team-btn";
      btn.textContent = `Lag ${i}`;
      btn.dataset.lagTeam = String(i);
      btn.addEventListener("click", async () => {
        sessionStorage.setItem("nsk2_lag_nr", String(i));
        setActiveLagButton(String(i));
        await fillLaguppstallningFormFromSelection();
      });
      box.appendChild(btn);
    }
  }

  function setActiveLagButton(lagNo) {
    document.querySelectorAll(".lag-team-btn").forEach((btn) => {
      if (btn.dataset.lagTeam === String(lagNo)) btn.classList.add("active-team-btn");
      else btn.classList.remove("active-team-btn");
    });
  }

  function renderLaguppstallningMatchOptions(matches) {
    const sel = byId("lineupMatch");
    if (!sel) return;
    sel.innerHTML = "";
    for (let i = 1; i <= matches; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `Match ${i}`;
      sel.appendChild(opt);
    }
  }

  function renderMatchButtons(matches) {
    const box = byId("matchButtons");
    const hiddenSelect = byId("lineupMatch");
    if (!box || !hiddenSelect) return;

    box.innerHTML = "";
    for (let i = 1; i <= matches; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "team-btn match-btn";
      btn.textContent = `Match ${i}`;
      btn.dataset.matchNo = String(i);
      btn.addEventListener("click", async () => {
        hiddenSelect.value = String(i);
        setActiveMatchButton(String(i));
        await fillLaguppstallningFormFromSelection();
      });
      box.appendChild(btn);
    }
  }

  function setActiveMatchButton(matchNo) {
    document.querySelectorAll(".match-btn").forEach((btn) => {
      if (btn.dataset.matchNo === String(matchNo)) btn.classList.add("active-team-btn");
      else btn.classList.remove("active-team-btn");
    });
  }

  function renderPlayerCountOptions(defaultCount) {
    const sel = byId("lineupPlayerCount");
    if (!sel) return;
    sel.innerHTML = "";
    for (let i = 1; i <= 25; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      if (i === Number(defaultCount)) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  async function renderCoachOptions() {
    const coachSelect = byId("lineupCoach");
    if (!coachSelect) return;
    const coaches = await DB.listCoaches();
    coachSelect.innerHTML = coaches.map(c => `<option value="${c.id}">${esc(c.full_name)}</option>`).join("");
  }

  async function getUsedPlayersInOtherTeams(poolId, currentLagNo) {
    const usedIds = await DB.listUsedPlayersInPool(poolId, currentLagNo);
    return new Set((usedIds || []).map(String));
  }

  async function renderLineupSelectors() {
    const box = byId("lineupSelectors");
    if (!box) return;

    try {
      const poolId = sessionStorage.getItem("nsk2_pool_id");
      const lagNo = sessionStorage.getItem("nsk2_lag_nr") || "1";
      const currentMatchNo = byId("lineupMatch")?.value || "1";

      const players = await DB.listPlayers();
      const usedSet = poolId ? await getUsedPlayersInOtherTeams(poolId, lagNo) : new Set();

      let matchRow = poolId ? await DB.getPoolTeamMatchConfig(poolId, lagNo, currentMatchNo) : null;
      if (!matchRow && poolId && String(currentMatchNo) !== "1") {
        matchRow = await DB.getPoolTeamMatchConfig(poolId, lagNo, 1);
      }

      let lineup = [];
      if (matchRow?.id) lineup = await DB.getLineup(matchRow.id);

      if ((!lineup || !lineup.length) && String(currentMatchNo) !== "1" && poolId) {
        const row1 = await DB.getPoolTeamMatchConfig(poolId, lagNo, 1);
        if (row1?.id) lineup = await DB.getLineup(row1.id);
      }

      const ownSet = new Set();
      if (matchRow?.goalie_player_id) ownSet.add(String(matchRow.goalie_player_id));
      lineup.filter(x => x.person_type === "player").forEach(x => ownSet.add(String(x.person_id)));

      const allowedPlayers = players.filter(p => !usedSet.has(String(p.id)) || ownSet.has(String(p.id)));
      const playerOptions = ['<option value="">Välj spelare</option>']
        .concat(allowedPlayers.map(p => `<option value="${p.id}">${esc(p.full_name)}</option>`))
        .join("");

      let html = `
        <div class="goalie-row">
          <div class="goalie-col">
            <label for="lineupGoalie">Målvakt</label>
            <select id="lineupGoalie">${playerOptions}</select>
          </div>
          <div class="goalie-col goalie-random-col">
            <label>&nbsp;</label>
            <button type="button" class="row-btn" data-random-goalie="1">Slumpa</button>
          </div>
        </div>
      `;

      for (let i = 1; i <= 25; i++) {
        html += `
          <label for="lineupPlayer${i}" data-player-label="${i}">Spelare ${i}</label>
          <select id="lineupPlayer${i}" data-player-select="${i}">${playerOptions}</select>
        `;
      }

      box.innerHTML = html;
      attachLineupHandlers();
      syncGoalieAgainstPlayers();
    } catch (err) {
      setText("appError", err.message || String(err));
    }
  }

  function updateVisiblePlayers() {
    const count = parseInt(byId("lineupPlayerCount")?.value || "1", 10);

    for (let i = 1; i <= 25; i++) {
      const label = document.querySelector(`[data-player-label="${i}"]`);
      const field = byId(`lineupPlayer${i}`);
      if (!field) continue;

      if (i <= count) {
        field.style.display = "";
        if (label) label.style.display = "";
      } else {
        field.style.display = "none";
        if (label) label.style.display = "none";
        field.value = "";
      }
    }

    updateCoachEnabledState();
    syncGoalieAgainstPlayers();
  }

  function queueAutoSaveLineup() {
    clearTimeout(window.__nskLineupSaveTimer);
    window.__nskLineupSaveTimer = setTimeout(async () => {
      try {
        await saveLaguppstallningMatchConfig(true);
      } catch (err) {
        setText("appError", err.message || String(err));
      }
    }, 500);
  }

  function updateCoachEnabledState() {
    const coachSelect = byId("lineupCoach");
    if (!coachSelect) return;

    const goalie = byId("lineupGoalie")?.value || "";
    const count = parseInt(byId("lineupPlayerCount")?.value || "1", 10);

    let selectedPlayers = 0;
    for (let i = 1; i <= count; i++) {
      const v = byId(`lineupPlayer${i}`)?.value || "";
      if (v) selectedPlayers++;
    }

    const enabled = !!goalie && selectedPlayers === count;
    coachSelect.disabled = !enabled;

    if (!enabled) {
      Array.from(coachSelect.options).forEach(opt => opt.selected = false);
    }
  }

  function attachLineupHandlers() {
    const goalie = byId("lineupGoalie");
    if (goalie && !goalie.dataset.bound) {
      goalie.dataset.bound = "1";
      goalie.addEventListener("change", async () => {
        syncGoalieAgainstPlayers();
        updateCoachEnabledState();
        await applyAutoCoachFromCurrentSelection();
        queueAutoSaveLineup();
      });
    }

    for (let i = 1; i <= 25; i++) {
      const el = byId(`lineupPlayer${i}`);
      if (el && !el.dataset.bound) {
        el.dataset.bound = "1";
        el.addEventListener("change", async () => {
          syncGoalieAgainstPlayers();
          updateCoachEnabledState();
          await applyAutoCoachFromCurrentSelection();
          queueAutoSaveLineup();
        });
      }
    }

    const coachSelect = byId("lineupCoach");
    if (coachSelect && !coachSelect.dataset.bound) {
      coachSelect.dataset.bound = "1";
      coachSelect.addEventListener("change", () => queueAutoSaveLineup());
    }

    const startTime = byId("lineupStartTime");
    if (startTime && !startTime.dataset.bound) {
      startTime.dataset.bound = "1";
      startTime.addEventListener("change", () => queueAutoSaveLineup());
    }

    const opponent = byId("lineupOpponent");
    if (opponent && !opponent.dataset.bound) {
      opponent.dataset.bound = "1";
      opponent.addEventListener("input", () => queueAutoSaveLineup());
    }

    const plan = byId("lineupPlan");
    if (plan && !plan.dataset.bound) {
      plan.dataset.bound = "1";
      plan.addEventListener("change", () => queueAutoSaveLineup());
    }

    const countSel = byId("lineupPlayerCount");
    if (countSel && !countSel.dataset.bound) {
      countSel.dataset.bound = "1";
      countSel.addEventListener("change", () => {
        updateVisiblePlayers();
        queueAutoSaveLineup();
      });
    }
  }

  function syncGoalieAgainstPlayers() {
    const goalieId = byId("lineupGoalie")?.value || "";
    const count = parseInt(byId("lineupPlayerCount")?.value || "1", 10);

    for (let i = 1; i <= count; i++) {
      const sel = byId(`lineupPlayer${i}`);
      if (!sel) continue;
      const currentValue = sel.value;
      Array.from(sel.options).forEach(opt => {
        if (opt.value && opt.value === goalieId) {
          opt.remove();
        }
      });
      if (currentValue === goalieId) {
        sel.value = "";
      }
    }
  }

  async function applyAutoCoach(playerIds) {
    const players = await DB.listPlayers();
    const coaches = await DB.listCoaches();
    const mappings = await DB.listPlayerCoachMap();

    const playerMap = {};
    players.forEach(p => { playerMap[String(p.id)] = p.full_name; });

    const coachMap = {};
    coaches.forEach(c => { coachMap[c.full_name] = String(c.id); });

    const playerCoachMap = {};
    mappings.forEach(m => { playerCoachMap[m.player_name] = m.coach_name; });

    const autoCoachIds = new Set();
    (playerIds || []).forEach(pid => {
      const playerName = playerMap[String(pid)];
      const coachName = playerCoachMap[playerName];
      if (coachName && coachMap[coachName]) autoCoachIds.add(coachMap[coachName]);
    });

    const coachSelect = byId("lineupCoach");
    if (!coachSelect) return;

    Array.from(coachSelect.options).forEach(opt => {
      if (autoCoachIds.has(String(opt.value))) opt.selected = true;
    });
  }

  async function applyAutoCoachFromCurrentSelection() {
    const count = parseInt(byId("lineupPlayerCount")?.value || "1", 10);
    const ids = [];

    const goalie = byId("lineupGoalie")?.value || "";
    if (goalie) ids.push(goalie);

    for (let i = 1; i <= count; i++) {
      const v = byId(`lineupPlayer${i}`)?.value || "";
      if (v) ids.push(v);
    }

    await applyAutoCoach(ids);
    updateCoachEnabledState();
  }

  async function randomizeGoalie() {
    const count = parseInt(byId("lineupPlayerCount")?.value || "1", 10);
    const selectedPlayerIds = [];

    for (let i = 1; i <= count; i++) {
      const v = byId(`lineupPlayer${i}`)?.value || "";
      if (v) selectedPlayerIds.push(String(v));
    }

    const players = await DB.listPlayers();
    const goalieStats = await DB.listGoalieStats();

    const statCount = {};
    players.forEach(p => { statCount[p.full_name] = 0; });
    goalieStats.forEach(g => {
      const n = String(g.goalie_name || "");
      statCount[n] = (statCount[n] || 0) + 1;
    });

    const candidates = players.filter(p => !selectedPlayerIds.includes(String(p.id)));
    if (!candidates.length) {
      setText("lineupMsg", "Ingen spelare finns kvar att slumpa som målvakt.");
      return;
    }

    let min = Infinity;
    candidates.forEach(p => {
      const c = statCount[p.full_name] ?? 0;
      if (c < min) min = c;
    });

    const lowest = candidates.filter(p => (statCount[p.full_name] ?? 0) === min);
    const chosen = lowest.length === 1
      ? lowest[0]
      : lowest[Math.floor(Math.random() * lowest.length)];

    const goalieSel = byId("lineupGoalie");
    if (goalieSel) goalieSel.value = String(chosen.id);

    syncGoalieAgainstPlayers();
    await applyAutoCoachFromCurrentSelection();
    queueAutoSaveLineup();

    setText("lineupMsg", `Målvakt slumpad: ${chosen.full_name}`);
  }

  async function fillLaguppstallningFormFromSelection() {
    const lagNo = sessionStorage.getItem("nsk2_lag_nr") || "1";
    const matchNo = byId("lineupMatch")?.value || "1";
    const poolId = sessionStorage.getItem("nsk2_pool_id") || "";

    const title = byId("laguppstallningTitle");
    if (title) title.textContent = `Lag ${lagNo} • Match ${matchNo}`;

    const fromCreate = sessionStorage.getItem("nsk2_lineup_from_create") === "1";
    if (fromCreate) {
      sessionStorage.removeItem("nsk2_lineup_from_create");

      if (byId("lineupStartTime")) byId("lineupStartTime").value = "";
      if (byId("lineupOpponent")) byId("lineupOpponent").value = "";
      if (byId("lineupPlan")) byId("lineupPlan").value = "Plan 1";
      if (byId("lineupGoalie")) byId("lineupGoalie").value = "";

      const coachSelect = byId("lineupCoach");
      if (coachSelect) {
        Array.from(coachSelect.options).forEach(opt => opt.selected = false);
      }

      for (let i = 1; i <= 25; i++) {
        const el = byId(`lineupPlayer${i}`);
        if (el) el.value = "";
      }

      updateCoachEnabledState();
      return;
    }

    if (!poolId) return;

    try {
      const rowCurrent = await DB.getPoolTeamMatchConfig(poolId, lagNo, matchNo);
      const row1 = String(matchNo) !== "1"
        ? await DB.getPoolTeamMatchConfig(poolId, lagNo, 1)
        : null;

      const sourceRow = rowCurrent || row1;

      await renderCoachOptions();
      await renderLineupSelectors();

      if (byId("lineupStartTime")) byId("lineupStartTime").value = rowCurrent?.start_time || "";
      if (byId("lineupOpponent")) byId("lineupOpponent").value = rowCurrent?.opponent || "";
      if (byId("lineupPlan")) byId("lineupPlan").value = rowCurrent?.plan || "Plan 1";
      if (byId("lineupPlayerCount")) {
        byId("lineupPlayerCount").value = String(
          rowCurrent?.player_count || sourceRow?.player_count || byId("lineupPlayerCount")?.value || "3"
        );
      }

      updateVisiblePlayers();
      setActiveMatchButton(matchNo);

      if (byId("lineupGoalie")) {
        byId("lineupGoalie").value = rowCurrent?.goalie_player_id || sourceRow?.goalie_player_id || "";
      }

      let lineup = [];
      if (rowCurrent?.id) {
        lineup = await DB.getLineup(rowCurrent.id);
      }

      if ((!lineup || !lineup.length) && row1?.id) {
        lineup = await DB.getLineup(row1.id);
      }

      if (lineup?.length) {
        const playerIds = lineup
          .filter(x => x.person_type === "player")
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map(x => String(x.person_id));

        const coachIds = lineup
          .filter(x => x.person_type === "coach")
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map(x => String(x.person_id));

        const coachSelect = byId("lineupCoach");
        if (coachSelect) {
          Array.from(coachSelect.options).forEach((opt) => {
            opt.selected = coachIds.includes(String(opt.value));
          });
        }

        for (let i = 1; i <= 25; i++) {
          const el = byId(`lineupPlayer${i}`);
          if (el) el.value = playerIds[i - 1] || "";
        }
      } else {
        const coachSelect = byId("lineupCoach");
        if (coachSelect) {
          Array.from(coachSelect.options).forEach((opt) => {
            opt.selected = false;
          });
        }

        for (let i = 1; i <= 25; i++) {
          const el = byId(`lineupPlayer${i}`);
          if (el) el.value = "";
        }
      }

      syncGoalieAgainstPlayers();
      await applyAutoCoachFromCurrentSelection();
      updateCoachEnabledState();

      if (!rowCurrent && String(matchNo) !== "1") {
        queueAutoSaveLineup();
      }
    } catch (err) {
      setText("appError", err.message || String(err));
    }
  }

  async function validateUniquePlayersAcrossPool(poolId, lagNo, matchNo, startTime, goalieId, playerIds) {
    const rows = await DB.listPoolTeamMatchConfigs(poolId);

    const currentMatchNo = String(matchNo);
    const currentLagNo = String(lagNo);
    const currentStart = String(startTime || "");

    for (const row of rows) {
      const sameLag = String(row.lag_no) === currentLagNo;
      const sameMatch = String(row.match_no) === currentMatchNo;

      if (sameLag && sameMatch) continue;

      const lineup = row.id ? await DB.getLineup(row.id) : [];
      const otherPlayers = lineup.filter(x => x.person_type === "player").map(x => String(x.person_id));

      if (!sameLag) {
        for (const pid of playerIds) {
          if (otherPlayers.includes(String(pid))) {
            return "En spelare finns redan i ett annat lag i poolspelet.";
          }
        }
      }

      if (!sameLag && goalieId && String(row.goalie_player_id || "") === String(goalieId)) {
        const otherStart = String(row.start_time || "");
        if (!currentStart || !otherStart) {
          if (sameMatch) return "Målvakten kan inte stå i samma matchnummer i två lag när starttid saknas.";
        } else if (currentStart === otherStart) {
          return "Målvakten har redan en match med samma starttid i ett annat lag.";
        }
      }
    }

    return "";
  }

  async function saveLaguppstallningMatchConfig(silent = false) {
    const poolId = sessionStorage.getItem("nsk2_pool_id") || "";
    const lagNo = sessionStorage.getItem("nsk2_lag_nr") || "1";
    const matchNo = byId("lineupMatch")?.value || "1";

    if (!poolId) {
      if (!silent) setText("appError", "Saknar valt poolspel.");
      return;
    }

    const goalie = byId("lineupGoalie")?.value || "";
    const playerCount = parseInt(byId("lineupPlayerCount")?.value || "1", 10);
    const selectedPlayers = [];

    for (let i = 1; i <= playerCount; i++) {
      const val = byId(`lineupPlayer${i}`)?.value || "";
      if (!val) continue;

      if (goalie && val === goalie) {
        if (!silent) setText("lineupMsg", "Målvakt kan inte vara samma som spelare.");
        return;
      }

      if (selectedPlayers.includes(val)) {
        if (!silent) setText("lineupMsg", "En spelare kan bara väljas en gång.");
        return;
      }

      selectedPlayers.push(val);
    }

    const poolConflict = await validateUniquePlayersAcrossPool(
      poolId,
      lagNo,
      matchNo,
      byId("lineupStartTime")?.value || "",
      goalie,
      selectedPlayers
    );

    if (poolConflict) {
      if (!silent) setText("lineupMsg", poolConflict);
      return;
    }

    try {
      await applyAutoCoachFromCurrentSelection();

      const coachSelect = byId("lineupCoach");
      const coachIds = coachSelect
        ? Array.from(coachSelect.selectedOptions).map((o) => o.value).filter(Boolean)
        : [];

      const matchRow = await DB.savePoolTeamMatchConfig({
        pool_id: poolId,
        lag_no: parseInt(lagNo, 10),
        match_no: parseInt(matchNo, 10),
        start_time: byId("lineupStartTime")?.value || null,
        opponent: byId("lineupOpponent")?.value?.trim() || "",
        plan: byId("lineupPlan")?.value || "Plan 1",
        player_count: playerCount,
        goalie_player_id: goalie || null
      });

      await DB.saveLineup(matchRow.id, selectedPlayers, coachIds);
      await regenerateShiftSchemaFor(poolId, lagNo, matchNo);

      const onBytesschemaPage = !!byId("shiftTableWrap");
      const activeShiftMatch = byId("shiftMatch")?.value || "";
      if (onBytesschemaPage && String(activeShiftMatch) === String(matchNo)) {
        await renderShiftSchema();
      }

      if (!silent) setText("lineupMsg", "Laguppställning sparad.");
    } catch (err) {
      setText("appError", err.message || String(err));
    }
  }

  async function initBytesschemaPage() {
    const teamBox = byId("shiftTeamButtons");
    const matchBox = byId("shiftMatchButtons");
    const matchSelect = byId("shiftMatch");
    if (!teamBox || !matchBox || !matchSelect) return;

    try {
      const poolId = sessionStorage.getItem("nsk2_pool_id");
      if (!poolId) {
        setText("shiftMsg", "Välj först ett poolspel från startsidan.");
        return;
      }

      const pool = await DB.getPool(poolId);
      const teams = parseInt(pool?.teams || "2", 10) || 2;
      const matches = parseInt(pool?.matches || "4", 10) || 4;

      renderShiftTeamButtons(teams);
      renderShiftMatchButtons(matches);
      renderShiftMatchOptions(matches);

      const lagNo = sessionStorage.getItem("nsk2_lag_nr") || "1";
      setActiveShiftTeamButton(lagNo);
      setActiveShiftMatchButton(matchSelect.value || "1");

      await renderShiftSchema();
    } catch (err) {
      setText("appError", err.message || String(err));
    }
  }

  function renderShiftTeamButtons(teams) {
    const box = byId("shiftTeamButtons");
    if (!box) return;
    box.innerHTML = "";

    for (let i = 1; i <= teams; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "team-btn lag-team-btn";
      btn.textContent = `Lag ${i}`;
      btn.dataset.shiftLag = String(i);
      btn.addEventListener("click", async () => {
        sessionStorage.setItem("nsk2_lag_nr", String(i));
        setActiveShiftTeamButton(String(i));
        await renderShiftSchema();
      });
      box.appendChild(btn);
    }
  }

  function setActiveShiftTeamButton(lagNo) {
    document.querySelectorAll("[data-shift-lag]").forEach(btn => {
      if (btn.dataset.shiftLag === String(lagNo)) btn.classList.add("active-team-btn");
      else btn.classList.remove("active-team-btn");
    });
  }

  function renderShiftMatchButtons(matches) {
    const box = byId("shiftMatchButtons");
    if (!box) return;
    box.innerHTML = "";

    for (let i = 1; i <= matches; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "team-btn match-btn";
      btn.textContent = `Match ${i}`;
      btn.dataset.shiftMatch = String(i);
      btn.addEventListener("click", async () => {
        const sel = byId("shiftMatch");
        if (sel) sel.value = String(i);
        setActiveShiftMatchButton(String(i));
        await renderShiftSchema();
      });
      box.appendChild(btn);
    }
  }

  function renderShiftMatchOptions(matches) {
    const sel = byId("shiftMatch");
    if (!sel) return;
    sel.innerHTML = "";
    for (let i = 1; i <= matches; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `Match ${i}`;
      sel.appendChild(opt);
    }
  }

  function setActiveShiftMatchButton(matchNo) {
    document.querySelectorAll("[data-shift-match]").forEach(btn => {
      if (btn.dataset.shiftMatch === String(matchNo)) btn.classList.add("active-team-btn");
      else btn.classList.remove("active-team-btn");
    });
  }

  async function toggleShiftDone(shiftNo) {
    const poolId = sessionStorage.getItem("nsk2_pool_id");
    const lagNo = sessionStorage.getItem("nsk2_lag_nr") || "1";
    const matchNo = byId("shiftMatch")?.value || "1";

    const el = document.querySelector(`[data-shift-toggle="${shiftNo}"]`);
    if (!el || !poolId) return;

    const nextDone = !el.classList.contains("done");
    el.classList.toggle("done", nextDone);

    try {
      await DB.setShiftDone(poolId, lagNo, matchNo, shiftNo, nextDone);
    } catch (err) {
      el.classList.toggle("done", !nextDone);
      setText("appError", err.message || String(err));
    }
  }

  async function regenerateShiftSchemaFor(poolId, lagNo, matchNo) {
    const pool = await DB.getPool(poolId);

    let row = await DB.getPoolTeamMatchConfig(poolId, lagNo, matchNo);
    let sourceRow = row;

    if (!sourceRow && String(matchNo) !== "1") {
      sourceRow = await DB.getPoolTeamMatchConfig(poolId, lagNo, 1);
    }

    if (!sourceRow?.id) {
      return [];
    }

    let lineup = await DB.getLineup(sourceRow.id);

    if (!lineup.length) {
      await DB.deleteShiftSchema(poolId, lagNo, matchNo);
      return [];
    }

    const playerIds = lineup
      .filter(x => x.person_type === "player")
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(x => String(x.person_id));

    if (!playerIds.length) {
      await DB.deleteShiftSchema(poolId, lagNo, matchNo);
      return [];
    }

    const playersOnField = parseInt(
      row?.player_count || sourceRow?.player_count || pool.players_on_field || 3,
      10
    );

    const shifts = buildShiftSchedule({
      matchNo: parseInt(matchNo, 10),
      playerIds,
      playersOnField,
      periods: parseInt(pool.periods || 1, 10),
      periodTime: parseInt(pool.period_time || 15, 10),
      subTime: parseInt(pool.sub_time || 90, 10)
    });

    await DB.saveShiftSchema(poolId, lagNo, matchNo, shifts);
    return shifts;
  }

  function buildShiftSchedule({ matchNo, playerIds, playersOnField, periods, periodTime, subTime }) {
    const shifts = [];
    const totalSeconds = periodTime * 60;
    const shiftCountPerPeriod = Math.max(1, Math.ceil(totalSeconds / subTime));
    const totalShifts = periods * shiftCountPerPeriod;

    if (!playerIds.length || playersOnField <= 0) return shifts;

    const ids = [...playerIds];
    const playerCount = ids.length;
    const onField = Math.min(playersOnField, playerCount);

    let startIndex = ((Math.max(0, matchNo - 1) * onField) % playerCount);

    const shiftCounts = {};
    ids.forEach(id => { shiftCounts[id] = 0; });

    let prevLine = [];
    const lineSeen = new Map();

    function lineKey(arr) {
      return [...arr].sort().join("|");
    }

    for (let shiftIndex = 0; shiftIndex < totalShifts; shiftIndex++) {
      const periodNo = Math.floor(shiftIndex / shiftCountPerPeriod) + 1;
      const shiftInPeriod = shiftIndex % shiftCountPerPeriod;

      const elapsed = shiftInPeriod * subTime;
      const left = Math.max(0, totalSeconds - elapsed);
      const mm = String(Math.floor(left / 60)).padStart(2, "0");
      const ss = String(left % 60).padStart(2, "0");

      let nextLine = [];
      for (let k = 0; k < onField; k++) {
        nextLine.push(ids[(startIndex + k) % playerCount]);
      }

      if (prevLine.length) {
        const prevSet = new Set(prevLine);
        const bench = ids.filter(id => !nextLine.includes(id));
        let overlap = nextLine.filter(id => prevSet.has(id)).length;
        const maxPreferredOverlap = Math.max(0, (onField * 2) - playerCount);

        if (overlap > maxPreferredOverlap) {
          for (let i = nextLine.length - 1; i >= 0 && overlap > maxPreferredOverlap; i--) {
            if (!prevSet.has(nextLine[i])) continue;

            let replacementIndex = -1;
            let bestScore = Infinity;
            for (let b = 0; b < bench.length; b++) {
              const candidate = bench[b];
              const score = shiftCounts[candidate];
              if (score < bestScore) {
                bestScore = score;
                replacementIndex = b;
              }
            }

            if (replacementIndex >= 0) {
              const out = nextLine[i];
              const inn = bench.splice(replacementIndex, 1)[0];
              bench.push(out);
              nextLine[i] = inn;
              overlap = nextLine.filter(id => prevSet.has(id)).length;
            }
          }
        }
      }

      const bench = ids.filter(id => !nextLine.includes(id)).sort((a, b) => shiftCounts[a] - shiftCounts[b]);
      for (let i = 0; i < nextLine.length && bench.length; i++) {
        const current = nextLine[i];
        const benchBest = bench[0];
        const currentWouldRepeat = (lineSeen.get(lineKey(nextLine)) || 0);

        if (shiftCounts[current] - shiftCounts[benchBest] >= 2 || currentWouldRepeat > 1) {
          nextLine[i] = bench.shift();
          bench.push(current);
          bench.sort((a, b) => shiftCounts[a] - shiftCounts[b]);
        }
      }

      nextLine.forEach(id => { shiftCounts[id] += 1; });
      const key = lineKey(nextLine);
      lineSeen.set(key, (lineSeen.get(key) || 0) + 1);

      shifts.push({
        period_no: periodNo,
        time_left: `${mm}:${ss}`,
        players: [...nextLine]
      });

      prevLine = [...nextLine];
      startIndex = (startIndex + onField) % playerCount;
    }

    return shifts;
  }

  async function renderShiftSchema() {
    const poolId = sessionStorage.getItem("nsk2_pool_id");
    const lagNo = sessionStorage.getItem("nsk2_lag_nr") || "1";
    const matchNo = byId("shiftMatch")?.value || "1";
    if (!poolId) return;

    await regenerateShiftSchemaFor(poolId, lagNo, matchNo);

    const pool = await DB.getPool(poolId);
    let row = await DB.getPoolTeamMatchConfig(poolId, lagNo, matchNo);
    if (!row && String(matchNo) !== "1") row = await DB.getPoolTeamMatchConfig(poolId, lagNo, 1);

    const players = await DB.listPlayers();
    const coaches = await DB.listCoaches();
    const playerMap = {};
    const coachMap = {};
    players.forEach(p => { playerMap[String(p.id)] = p.full_name; });
    coaches.forEach(c => { coachMap[String(c.id)] = c.full_name; });

    const title = `Match ${matchNo} • Lag ${lagNo}`;
    setText("bytesschemaTitle", title);
    setText("shiftHeaderMain", title);
    setText("shiftStart", row?.start_time || "—");
    setText("shiftDate", pool?.pool_date || "—");
    setText("shiftOpponent", row?.opponent || "—");
    setText("shiftPlan", row?.plan || "—");

    const goalieName = row?.goalie_player_id ? (playerMap[String(row.goalie_player_id)] || "—") : "—";
    setText("shiftGoalieName", goalieName);

    let coachNames = "—";
    if (row?.id) {
      const lineup = await DB.getLineup(row.id);
      const ids = lineup
        .filter(x => x.person_type === "coach")
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(x => coachMap[String(x.person_id)] || "—")
        .filter(Boolean);
      if (ids.length) coachNames = ids.join(", ");
    }
    setText("shiftCoachNames", coachNames);

    setActiveShiftTeamButton(lagNo);
    setActiveShiftMatchButton(matchNo);

    const rows = await DB.listShiftSchema(poolId, lagNo, matchNo);
    const wrap = byId("shiftTableWrap");
    if (!wrap) return;

    if (!rows.length) {
      wrap.innerHTML = '<div class="small">Inget bytesschema ännu. Spara laguppställning först.</div>';
      return;
    }

    wrap.innerHTML = `
      <table class="shift-table">
        <thead>
          <tr>
            <th></th>
            <th>#</th>
            <th>Tid kvar</th>
            <th>På plan</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => {
            const shiftNo = i + 1;
            const names = (Array.isArray(r.players_json) ? r.players_json : [])
              .map(id => playerMap[String(id)] || "—")
              .join("<br>");
            const done = r.done ? "done" : "";
            return `
              <tr>
                <td class="check-cell"><span class="shift-check ${done}" data-shift-toggle="${shiftNo}"></span></td>
                <td>${shiftNo}</td>
                <td>${esc(r.time_left)}</td>
                <td class="shift-players">${names || "—"}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
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

    await renderPlayers();
    await renderCoaches();

    if (!truppenRealtime) {
      truppenRealtime = await DB.subscribeTruppen(async (type) => {
        if (type === "players") await renderPlayers();
        if (type === "coaches") await renderCoaches();
      });
    }
  }

  async function initGoalieStatsPage() {
    const list = byId("goalieStatsList");
    if (!list) return;

    const stats = await DB.listGoalieStats();
    const grouped = {};

    stats.forEach((row) => {
      const name = row.goalie_name || "Okänd";
      if (!grouped[name]) grouped[name] = new Set();
      grouped[name].add(row.match_id);
    });

    const rows = Object.entries(grouped)
      .map(([name, set]) => ({ name, count: set.size }))
      .sort((a, b) => b.count - a.count);

    list.innerHTML = rows.map((r) => `
      <div class="listrow">
        <strong>${esc(r.name)}</strong> — ${r.count} matcher
      </div>
    `).join("");
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
