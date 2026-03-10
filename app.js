window.NSK2App = (() => {
  function byId(id){ return document.getElementById(id); }
  function esc(s){
    return String(s ?? "").replace(/[&<>"]/g, m => (
      { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m]
    ));
  }
  function setText(id, text){
    const el = byId(id);
    if(el) el.textContent = text || "";
  }

  let truppenRealtime = null;
  let globalClicksBound = false;
  let laguppstallningBound = false;

  async function init(){
    if(window.Auth?.init) await Auth.init();
    bindGlobalClicks();
    await initStartsidaPage();
    await initSkapaPoolspelPage();
    await initLaguppstallningPage();
    await initTruppenPage();
    await initGoalieStatsPage();
  }

  function bindGlobalClicks(){
    if(globalClicksBound) return;
    globalClicksBound = true;

    document.addEventListener("click", async e => {
      const t = e.target;
      if(!(t instanceof HTMLElement)) return;

      try{
        if(t.dataset.editPool){
          sessionStorage.setItem("nsk2_edit_pool_id", t.dataset.editPool);
          window.location.href = "../skapapoolspel/";
          return;
        }
        if(t.dataset.deletePool){
          const ok = window.confirm("Ta bort poolspelet?");
          if(!ok) return;
          await DB.deletePool(t.dataset.deletePool);
          window.location.reload();
          return;
        }
        if(t.dataset.poolId && t.dataset.lagNo){
          sessionStorage.setItem("nsk2_pool_id", t.dataset.poolId || "");
          sessionStorage.setItem("nsk2_lag_nr", t.dataset.lagNo || "1");
          window.location.href = "../laguppstallning/";
          return;
        }
        if(t.dataset.savePlayer){ await saveInlinePlayer(t.dataset.savePlayer); return; }
        if(t.dataset.saveCoach){ await saveInlineCoach(t.dataset.saveCoach); return; }
        if(t.dataset.deletePlayer){ await deletePlayer(t.dataset.deletePlayer); return; }
        if(t.dataset.deleteCoach){ await deleteCoach(t.dataset.deleteCoach); return; }
      }catch(err){
        setText("appError", err.message || String(err));
      }
    });
  }

  async function initStartsidaPage(){
    const box = byId("savedPoolsList");
    if(!box) return;
    try{
      const pools = await DB.listPools();
      if(!pools.length){
        box.innerHTML = '<div class="listrow">Inga sparade poolspel ännu.</div>';
        return;
      }
      box.innerHTML = pools.map(p => {
        const teams = parseInt(p.teams || "2", 10) || 2;
        const lagButtons = Array.from({ length: teams }, (_, i) => {
          const lagNo = i + 1;
          return `<button class="team-btn" type="button" data-pool-id="${p.id}" data-lag-no="${lagNo}">Lag ${lagNo}</button>`;
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
          </article>`;
      }).join("");
    }catch(err){
      setText("appError", err.message || String(err));
    }
  }

  async function initSkapaPoolspelPage(){
    const saveBtn = byId("savePool");
    const teamsSel = byId("teams");
    if(!saveBtn || !teamsSel) return;

    const editId = sessionStorage.getItem("nsk2_edit_pool_id");
    if(editId){
      try{
        const pool = await DB.getPool(editId);
        if(byId("poolPlace")) byId("poolPlace").value = pool.place || "";
        if(byId("poolDate")) byId("poolDate").value = pool.pool_date || "";
        if(byId("teams")) byId("teams").value = String(pool.teams || 2);
        if(byId("matches")) byId("matches").value = String(pool.matches || 4);
        if(byId("players")) byId("players").value = String(pool.players_on_field || 3);
        if(byId("periods")) byId("periods").value = String(pool.periods || 1);
        if(byId("periodTime")) byId("periodTime").value = String(pool.period_time || 15);
        if(byId("subTime")) byId("subTime").value = String(pool.sub_time || 90);
      }catch(err){
        setText("appError", err.message || String(err));
      }
    }

    renderTeamButtons();
    renderLaguppstallningButtons();
    teamsSel.addEventListener("change", () => {
      renderTeamButtons();
      renderLaguppstallningButtons();
    });
    saveBtn.addEventListener("click", savePool);
  }

  function renderTeamButtons(){
    const teams = parseInt(byId("teams")?.value || "2", 10);
    const box = byId("teamButtons");
    if(!box) return;
    box.innerHTML = "";
    for(let i = 1; i <= teams; i++){
      const btn = document.createElement("button");
      btn.className = "team-btn";
      btn.type = "button";
      btn.textContent = `Lag ${i}`;
      box.appendChild(btn);
    }
  }

  function renderLaguppstallningButtons(){
    const teams = parseInt(byId("teams")?.value || "2", 10);
    const box = byId("lagButtons");
    if(!box) return;
    box.innerHTML = "";
    for(let i = 1; i <= teams; i++){
      const btn = document.createElement("button");
      btn.className = "team-btn";
      btn.type = "button";
      btn.textContent = `Lag ${i}`;
      btn.addEventListener("click", () => {
        sessionStorage.setItem("nsk2_lag_nr", String(i));
        window.location.href = "../laguppstallning/";
      });
      box.appendChild(btn);
    }
  }

  async function savePool(){
    try{
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
      if(editId){
        await DB.updatePool(editId, payload);
        sessionStorage.removeItem("nsk2_edit_pool_id");
      }else{
        await DB.addPool(payload);
      }
      setText("poolMsg", "Poolspel sparat");
      window.location.href = "../startsida/";
    }catch(err){
      setText("appError", err.message || String(err));
    }
  }

  async function initLaguppstallningPage(){
    const teamButtonsBox = byId("laguppstallningTeamButtons");
    const matchSelect = byId("lineupMatch");
    const saveBtn = byId("saveLagMatchBtn");
    if(!teamButtonsBox || !matchSelect || !saveBtn) return;

    try{
      const poolId = sessionStorage.getItem("nsk2_pool_id");
      let teams = 2, matches = 4, playersOnField = 3;
      if(poolId){
        const pool = await DB.getPool(poolId);
        teams = parseInt(pool?.teams || "2", 10) || 2;
        matches = parseInt(pool?.matches || "4", 10) || 4;
        playersOnField = parseInt(pool?.players_on_field || "3", 10) || 3;
      }

      renderLaguppstallningTeamButtons(teams);
      renderLaguppstallningMatchOptions(matches);
      renderPlayerCountOptions(playersOnField);
      await renderLineupSelectors();

      const savedLag = sessionStorage.getItem("nsk2_lag_nr") || "1";
      setActiveLagButton(savedLag);

      if(!laguppstallningBound){
        laguppstallningBound = true;
        matchSelect.addEventListener("change", () => fillLaguppstallningFormFromSelection());
        saveBtn.addEventListener("click", saveLaguppstallningMatchConfig);
      }

      await fillLaguppstallningFormFromSelection();
    }catch(err){
      setText("appError", err.message || String(err));
    }
  }

  function renderLaguppstallningTeamButtons(teams){
    const box = byId("laguppstallningTeamButtons");
    if(!box) return;
    box.innerHTML = "";
    for(let i = 1; i <= teams; i++){
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

  function setActiveLagButton(lagNo){
    document.querySelectorAll(".lag-team-btn").forEach(btn => {
      if(btn.dataset.lagTeam === String(lagNo)) btn.classList.add("active-team-btn");
      else btn.classList.remove("active-team-btn");
    });
  }

  function renderLaguppstallningMatchOptions(matches){
    const sel = byId("lineupMatch");
    if(!sel) return;
    sel.innerHTML = "";
    for(let i = 1; i <= matches; i++){
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `Match ${i}`;
      sel.appendChild(opt);
    }
  }

  function renderPlayerCountOptions(defaultCount){
    const sel = byId("lineupPlayerCount");
    if(!sel) return;
    sel.innerHTML = "";
    for(let i = 1; i <= 10; i++){
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      if(i === defaultCount) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  async function renderLineupSelectors(){
    const box = byId("lineupSelectors");
    if(!box) return;
    const players = await DB.listPlayers();
    const coaches = await DB.listCoaches();

    const playerOptions = ['<option value="">Välj spelare</option>']
      .concat(players.map(p => `<option value="${p.id}">${esc(p.full_name)}</option>`))
      .join("");
    const coachOptions = ['<option value="">Välj tränare</option>']
      .concat(coaches.map(c => `<option value="${c.id}">${esc(c.full_name)}</option>`))
      .join("");

    let html = `
      <label for="lineupGoalie">Målvakt</label>
      <select id="lineupGoalie">${playerOptions}</select>

      <label for="lineupCoach">Tränare</label>
      <select id="lineupCoach">${coachOptions}</select>
    `;
    for(let i = 1; i <= 10; i++){
      html += `
        <label for="lineupPlayer${i}">Spelare ${i}</label>
        <select id="lineupPlayer${i}">${playerOptions}</select>
      `;
    }
    box.innerHTML = html;
  }

  async function fillLaguppstallningFormFromSelection(){
    const lagNo = sessionStorage.getItem("nsk2_lag_nr") || "1";
    const matchNo = byId("lineupMatch")?.value || "1";
    const poolId = sessionStorage.getItem("nsk2_pool_id") || "";

    const title = byId("laguppstallningTitle");
    if(title) title.textContent = `Lag ${lagNo} • Match ${matchNo}`;
    if(!poolId) return;

    try{
      const row = await DB.getPoolTeamMatchConfig(poolId, lagNo, matchNo);

      if(byId("lineupStartTime")) byId("lineupStartTime").value = row?.start_time || "";
      if(byId("lineupOpponent")) byId("lineupOpponent").value = row?.opponent || "";
      if(byId("lineupPlan")) byId("lineupPlan").value = row?.plan || "Plan 1";
      if(byId("lineupPlayerCount")) byId("lineupPlayerCount").value = String(row?.player_count || byId("lineupPlayerCount")?.value || "3");

      if(byId("lineupGoalie")) byId("lineupGoalie").value = row?.goalie_player_id || "";
      if(byId("lineupCoach")) byId("lineupCoach").value = row?.coach_id || "";
      for(let i = 1; i <= 10; i++){
        const el = byId(`lineupPlayer${i}`);
        if(el) el.value = row?.[`player${i}_id`] || "";
      }
    }catch(err){
      setText("appError", err.message || String(err));
    }
  }

  async function saveLaguppstallningMatchConfig(){
    const poolId = sessionStorage.getItem("nsk2_pool_id") || "";
    const lagNo = sessionStorage.getItem("nsk2_lag_nr") || "1";
    const matchNo = byId("lineupMatch")?.value || "1";
    if(!poolId){
      setText("appError", "Saknar valt poolspel.");
      return;
    }

    try{
      const payload = {
        pool_id: poolId,
        lag_no: parseInt(lagNo, 10),
        match_no: parseInt(matchNo, 10),
        start_time: byId("lineupStartTime")?.value || null,
        opponent: byId("lineupOpponent")?.value?.trim() || "",
        plan: byId("lineupPlan")?.value || "Plan 1",
        player_count: parseInt(byId("lineupPlayerCount")?.value || "3", 10),
        goalie_player_id: byId("lineupGoalie")?.value || null,
        coach_id: byId("lineupCoach")?.value || null
      };
      for(let i = 1; i <= 10; i++){
        payload[`player${i}_id`] = byId(`lineupPlayer${i}`)?.value || null;
      }

      await DB.savePoolTeamMatchConfig(payload);
      setText("lineupMsg", "Laguppställning sparad.");
    }catch(err){
      setText("appError", err.message || String(err));
    }
  }

  function rowHtml(item, type){
    return `
      <div class="person-row">
        <div class="person-main">
          <input class="inline-name-input" value="${esc(item.full_name)}" data-inline-${type}="${item.id}">
        </div>
        <div class="row-actions">
          <button class="row-btn" data-save-${type}="${item.id}">Spara</button>
          <button class="row-btn danger" data-delete-${type}="${item.id}">Ta bort</button>
        </div>
      </div>
    `;
  }

  async function renderPlayers(){
    const list = byId("playersList");
    if(!list) return;
    const players = await DB.listPlayers();
    list.innerHTML = players.length ? players.map(p => rowHtml(p, "player")).join("") : '<div class="muted-note">Inga spelare ännu.</div>';
  }

  async function renderCoaches(){
    const list = byId("coachesList");
    if(!list) return;
    const coaches = await DB.listCoaches();
    list.innerHTML = coaches.length ? coaches.map(c => rowHtml(c, "coach")).join("") : '<div class="muted-note">Inga tränare ännu.</div>';
  }

  async function addPlayer(){
    const input = byId("playerInput");
    const name = input?.value?.trim();
    if(!name) return;
    await DB.addPlayer(name);
    input.value = "";
    await renderPlayers();
  }

  async function addCoach(){
    const input = byId("coachInput");
    const name = input?.value?.trim();
    if(!name) return;
    await DB.addCoach(name);
    input.value = "";
    await renderCoaches();
  }

  async function saveInlinePlayer(id){
    const el = document.querySelector(`[data-inline-player="${id}"]`);
    if(!el) return;
    await DB.updatePlayer(id, el.value.trim());
    await renderPlayers();
  }

  async function saveInlineCoach(id){
    const el = document.querySelector(`[data-inline-coach="${id}"]`);
    if(!el) return;
    await DB.updateCoach(id, el.value.trim());
    await renderCoaches();
  }

  async function deletePlayer(id){ await DB.deletePlayer(id); await renderPlayers(); }
  async function deleteCoach(id){ await DB.deleteCoach(id); await renderCoaches(); }

  async function initTruppenPage(){
    if(!byId("playersList") && !byId("coachesList")) return;
    byId("addPlayerBtn")?.addEventListener("click", addPlayer);
    byId("addCoachBtn")?.addEventListener("click", addCoach);
    await renderPlayers();
    await renderCoaches();

    if(!truppenRealtime){
      truppenRealtime = await DB.subscribeTruppen(async type => {
        if(type === "players") await renderPlayers();
        if(type === "coaches") await renderCoaches();
      });
    }
  }

  async function initGoalieStatsPage(){
    const list = byId("goalieStatsList");
    if(!list) return;
    const stats = await DB.listGoalieStats();
    const grouped = {};
    stats.forEach(row => {
      const name = row.goalie_name || "Okänd";
      if(!grouped[name]) grouped[name] = new Set();
      grouped[name].add(row.match_id);
    });
    const rows = Object.entries(grouped)
      .map(([name, set]) => ({ name, count: set.size }))
      .sort((a, b) => b.count - a.count);

    list.innerHTML = rows.map(r => `
      <div class="listrow">
        <strong>${esc(r.name)}</strong> — ${r.count} matcher
      </div>
    `).join("");
  }

  return { init };
})();

window.addEventListener("DOMContentLoaded", () => {
  window.NSK2App.init().catch(err => {
    const el = document.getElementById("appError");
    if(el) el.textContent = err.message || String(err);
    console.error(err);
  });
});
