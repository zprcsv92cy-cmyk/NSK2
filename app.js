window.NSK2App = (() => {
  let players = [];
  let coaches = [];
  let pools = [];
  let currentMatchId = null;
  let lineups = [];
  let timerHandle = null;
  let timerElapsed = 0;
  const subs = [];

  function byId(id){ return document.getElementById(id); }
  function txt(id, value){ const el = byId(id); if(el) el.textContent = value ?? ""; }
  function html(id, value){ const el = byId(id); if(el) el.innerHTML = value ?? ""; }
  function val(id){ return byId(id)?.value?.trim?.() || ""; }
  function esc(s){ return String(s ?? "").replace(/[&<>\"]/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m])); }
  function mmss(total){ const m=String(Math.floor(total/60)).padStart(2,"0"); const s=String(total%60).padStart(2,"0"); return `${m}:${s}`; }

  function activateMenu(){
    document.querySelectorAll(".mainmenu a").forEach(a => {
      const href = a.getAttribute("href");
      if(href && location.pathname.startsWith(href)) a.classList.add("active");
    });
  }

  async function loadPlayers(){
    players = await DB.listPlayers();
    const el = byId("playersList");
    if(el){
      el.innerHTML = players.length ? players.map(p => `
        <div class="person-row">
          <div class="person-name">${esc(p.full_name)}</div>
          <button class="row-btn" data-edit-player="${p.id}">Redigera</button>
          <button class="row-btn" data-delete-player="${p.id}">Ta bort</button>
        </div>
      `).join("") : '<div class="muted-note">Inga spelare ännu.</div>';
    }
    txt("teamCount", players.length);
    txt("playersTotal", players.length);
  }

  async function loadCoaches(){
    coaches = await DB.listCoaches();
    const el = byId("coachesList");
    if(el){
      el.innerHTML = coaches.length ? coaches.map(c => `
        <div class="person-row">
          <div class="person-name">${esc(c.full_name)}</div>
          <button class="row-btn" data-edit-coach="${c.id}">Redigera</button>
          <button class="row-btn" data-delete-coach="${c.id}">Ta bort</button>
        </div>
      `).join("") : '<div class="muted-note">Inga tränare ännu.</div>';
    }
    txt("coachesTotal", coaches.length);
  }

  async function addPlayer(){
    const name = val("playerInput");
    if(!name) return txt("playersMsg", "Skriv ett namn.");
    await DB.addPlayer(name);
    byId("playerInput").value = "";
    txt("playersMsg", "Sparad.");
    await loadPlayers();
  }

  async function addCoach(){
    const name = val("coachInput");
    if(!name) return txt("coachesMsg", "Skriv ett namn.");
    await DB.addCoach(name);
    byId("coachInput").value = "";
    txt("coachesMsg", "Sparad.");
    await loadCoaches();
  }

  async function editPlayer(id){
    const row = players.find(x => x.id === id);
    if(!row) return;
    const next = prompt("Redigera spelare", row.full_name);
    if(!next || next.trim() === row.full_name) return;
    await DB.updatePlayer(id, { full_name: next.trim() });
    await loadPlayers();
  }

  async function editCoach(id){
    const row = coaches.find(x => x.id === id);
    if(!row) return;
    const next = prompt("Redigera tränare", row.full_name);
    if(!next || next.trim() === row.full_name) return;
    await DB.updateCoach(id, { full_name: next.trim() });
    await loadCoaches();
  }

  async function deletePlayer(id){ await DB.deletePlayer(id); await loadPlayers(); }
  async function deleteCoach(id){ await DB.deleteCoach(id); await loadCoaches(); }

  async function loadPools(){
    pools = await DB.listPools();
    txt("poolsTotal", pools.length);

    const home = byId("savedPoolsList");
    if(home){
      home.innerHTML = pools.length ? pools.map(p => `
        <article class="pool-item">
          <div class="pool-top">
            <div>
              <div class="pool-title">${esc(p.pool_date || "Utan datum")} • ${esc(p.place || "Utan plats")}</div>
              <div class="pool-meta">${esc(p.title)}</div>
            </div>
            <div class="status-badge">${esc(p.status || "Aktiv")}</div>
          </div>
          <div class="pool-actions">
            <button data-open-pool="${p.id}">Påbörja poolspel</button>
            <button class="ghost" data-edit-pool="${p.id}">Redigera</button>
            <button class="ghost" data-delete-pool="${p.id}">Ta bort</button>
          </div>
        </article>
      `).join("") : '<div class="listrow">Inga sparade poolspel ännu.</div>';
    }

    const page = byId("poolPageList");
    if(page){
      page.innerHTML = pools.length ? pools.map(p => `
        <div class="listrow">
          <strong>${esc(p.title)}</strong> – ${esc(p.pool_date || "")} – ${esc(p.place || "")}
          <button class="ghost" data-open-pool="${p.id}" style="margin-left:10px">Öppna</button>
        </div>
      `).join("") : '<div class="listrow">Inga poolspel ännu.</div>';
    }
  }

  async function addPool(){
    const title = val("poolName");
    const place = val("poolPlace");
    const pool_date = byId("poolDate")?.value || null;
    if(!title) return txt("poolMsg", "Skriv namn på poolspelet.");
    await DB.addPool({ title, place, pool_date });
    ["poolName","poolPlace","poolDate"].forEach(id => { const el = byId(id); if(el) el.value = ""; });
    txt("poolMsg", "Poolspel sparat.");
    await loadPools();
  }

  async function editPool(id){
    const row = pools.find(x => x.id === id);
    if(!row) return;
    const next = prompt("Redigera poolspel", row.title);
    if(!next || next.trim() === row.title) return;
    await DB.updatePool(id, { title: next.trim() });
    await loadPools();
  }

  async function deletePool(id){
    await DB.deletePool(id);
    await loadPools();
  }

  async function openPool(id){
    const matches = await DB.listMatchesByPool(id);
    if(matches.length){
      currentMatchId = matches[0].id;
    } else {
      const pool = pools.find(p => p.id === id);
      const m = await DB.addMatch({
        pool_id: id,
        title: pool?.title || "Match",
        opponent: "",
        place: pool?.place || "",
        match_time: "",
        status: "Kommande",
        active_lineup_index: 0,
        shift_seconds: 90
      });
      currentMatchId = m.id;
    }
    sessionStorage.setItem("nsk2_current_match_id", currentMatchId);
    location.href = "/NSK2/matchvy/";
  }

  async function loadLineups(matchId = null){
    const id = matchId || sessionStorage.getItem("nsk2_current_match_id");
    if(!id) return;
    lineups = await DB.listLineups(id);
    const el = byId("lineupList");
    if(!el) return;
    el.innerHTML = lineups.length ? lineups.map(l => `
      <div class="listrow"><strong>Byte ${l.lineup_no}</strong> – ${l.players.map(p => esc(p.full_name)).join(", ")}</div>
    `).join("") : '<div class="listrow">Inget bytesschema ännu.</div>';
  }

  async function generateLineups(){
    const id = sessionStorage.getItem("nsk2_current_match_id");
    if(!id) return txt("lineupMsg", "Öppna först ett poolspel så att en match väljs.");
    if(!players.length) players = await DB.listPlayers();
    const ids = players.map(p => p.id);
    if(!ids.length) return txt("lineupMsg", "Inga spelare i truppen.");

    const perLine = Math.min(5, Math.max(3, Math.ceil(ids.length / 4)));
    const generated = [];
    for(let i=0;i<4;i++){
      const player_ids = [];
      for(let j=0;j<perLine;j++){
        player_ids.push(ids[(i + j*4) % ids.length]);
      }
      generated.push({ lineup_no: i+1, player_ids: [...new Set(player_ids)] });
    }

    await DB.replaceLineups(id, generated);
    txt("lineupMsg", "Hockeyrotation skapad.");
    await loadLineups(id);
    await loadMatchView(id);
  }

  async function getCurrentMatch(id){
    for(const pool of pools){
      const matches = await DB.listMatchesByPool(pool.id);
      const found = matches.find(m => m.id === id);
      if(found) return found;
    }
    return null;
  }

  async function loadMatchView(matchId = null){
    const id = matchId || sessionStorage.getItem("nsk2_current_match_id");
    if(!id) return;
    currentMatchId = id;
    sessionStorage.setItem("nsk2_current_match_id", id);

    const match = await getCurrentMatch(id);
    if(!match) return;

    if(byId("matchTitle")) byId("matchTitle").value = match.title || "";
    if(byId("matchOpponent")) byId("matchOpponent").value = match.opponent || "";
    if(byId("matchPlace")) byId("matchPlace").value = match.place || "";
    if(byId("matchTime")) byId("matchTime").value = match.match_time || "";
    if(byId("matchShiftSeconds")) byId("matchShiftSeconds").value = match.shift_seconds || 90;

    lineups = await DB.listLineups(id);
    const idx = Number(match.active_lineup_index || 0);
    const current = lineups[idx] || { players: [] };
    const next = lineups[(idx + 1) % Math.max(1, lineups.length)] || { players: [] };

    txt("shiftLabel", lineups.length ? `Byte ${idx + 1} / ${lineups.length}` : "Inget schema");
    html("matchInfo", `
      <div class="listrow">Match: ${esc(match.title || "—")}</div>
      <div class="listrow">Motståndare: ${esc(match.opponent || "—")}</div>
      <div class="listrow">Plats: ${esc(match.place || "—")}</div>
      <div class="listrow">Tid: ${esc(match.match_time || "—")}</div>
    `);
    txt("currentPlayers", current.players.map(p => p.full_name).join(" • ") || "—");
    txt("nextPlayers", next.players.map(p => p.full_name).join(" • ") || "—");
  }

  async function saveMatchMeta(){
    const id = sessionStorage.getItem("nsk2_current_match_id");
    if(!id) return txt("matchMsg", "Öppna först ett poolspel.");
    await DB.updateMatch(id, {
      title: val("matchTitle"),
      opponent: val("matchOpponent"),
      place: val("matchPlace"),
      match_time: val("matchTime"),
      shift_seconds: Number(byId("matchShiftSeconds")?.value || 90)
    });
    txt("matchMsg", "Matchinfo sparad.");
    await loadMatchView(id);
  }

  async function nextShift(){
    const id = sessionStorage.getItem("nsk2_current_match_id");
    if(!id) return;
    const match = await getCurrentMatch(id);
    if(!match) return;
    const next = lineups.length ? ((Number(match.active_lineup_index || 0) + 1) % lineups.length) : 0;
    await DB.updateMatch(id, { active_lineup_index: next });
    await loadMatchView(id);
  }

  async function loadGoalieStats(matchId = null){
    const id = matchId || sessionStorage.getItem("nsk2_current_match_id");
    const el = byId("goalieStatsList");
    if(!id || !el) return;
    const stats = await DB.listGoalieStats(id);
    el.innerHTML = stats.length ? stats.map(g => {
      const pct = Number(g.shots) > 0 ? Math.round((Number(g.saves) / Number(g.shots)) * 100) : 0;
      return `<div class="listrow"><strong>${esc(g.goalie_name)}</strong> – Skott: ${g.shots}, Räddningar: ${g.saves}, Insläppta: ${g.goals_allowed}, Räddningsprocent: ${pct}%</div>`;
    }).join("") : '<div class="listrow">Ingen statistik ännu.</div>';
  }

  async function addGoalieStat(){
    const id = sessionStorage.getItem("nsk2_current_match_id");
    if(!id) return txt("goalieMsg", "Öppna först en match via poolspel.");
    const goalie_name = val("goalieName");
    if(!goalie_name) return txt("goalieMsg", "Skriv målvaktens namn.");
    await DB.addGoalieStat({
      match_id: id,
      goalie_name,
      shots: Number(byId("goalieShots")?.value || 0),
      saves: Number(byId("goalieSaves")?.value || 0),
      goals_allowed: Number(byId("goalieGoals")?.value || 0)
    });
    ["goalieName","goalieShots","goalieSaves","goalieGoals"].forEach(id => { const el = byId(id); if(el) el.value = ""; });
    txt("goalieMsg", "Statistik sparad.");
    await loadGoalieStats(id);
  }

  async function startTimer(){
    if(timerHandle) return;
    const shift = Number(byId("matchShiftSeconds")?.value || 90);
    timerElapsed = 0;
    txt("matchTimer", "00:00");
    timerHandle = setInterval(async () => {
      timerElapsed += 1;
      txt("matchTimer", mmss(timerElapsed));
      if(timerElapsed >= shift){
        timerElapsed = 0;
        await nextShift();
      }
    }, 1000);
  }

  function stopTimer(){
    clearInterval(timerHandle);
    timerHandle = null;
  }

  async function subscribeRealtime(){
    const tables = ["nsk_players","nsk_coaches","nsk_pools","nsk_matches","nsk_lineups","nsk_lineup_players","nsk_goalie_stats"];
    for(const table of tables){
      const channel = await DB.subscribe(table, async () => {
        if(table === "nsk_players") await loadPlayers();
        if(table === "nsk_coaches") await loadCoaches();
        if(table === "nsk_pools") await loadPools();
        if(table === "nsk_goalie_stats") await loadGoalieStats();
        if(table === "nsk_lineups" || table === "nsk_lineup_players") {
          await loadLineups();
          await loadMatchView();
        }
        if(table === "nsk_matches") await loadMatchView();
      });
      subs.push(channel);
    }
  }

  async function bind(){
    byId("addPlayerBtn")?.addEventListener("click", addPlayer);
    byId("addCoachBtn")?.addEventListener("click", addCoach);
    byId("savePoolBtn")?.addEventListener("click", addPool);
    byId("generateLineupsBtn")?.addEventListener("click", generateLineups);
    byId("saveGoalieStatBtn")?.addEventListener("click", addGoalieStat);
    byId("saveMatchBtn")?.addEventListener("click", saveMatchMeta);
    byId("nextShiftBtn")?.addEventListener("click", nextShift);
    byId("startTimerBtn")?.addEventListener("click", startTimer);
    byId("stopTimerBtn")?.addEventListener("click", stopTimer);
    byId("coachFullscreenBtn")?.addEventListener("click", () => document.body.classList.toggle("coach-fullscreen"));

    document.addEventListener("click", async e => {
      const t = e.target;
      if(!(t instanceof HTMLElement)) return;
      if(t.dataset.editPlayer) return editPlayer(t.dataset.editPlayer);
      if(t.dataset.deletePlayer) return deletePlayer(t.dataset.deletePlayer);
      if(t.dataset.editCoach) return editCoach(t.dataset.editCoach);
      if(t.dataset.deleteCoach) return deleteCoach(t.dataset.deleteCoach);
      if(t.dataset.openPool) return openPool(t.dataset.openPool);
      if(t.dataset.editPool) return editPool(t.dataset.editPool);
      if(t.dataset.deletePool) return deletePool(t.dataset.deletePool);
    });
  }

  async function init(){
    activateMenu();
    await Auth.init();
    await bind();
    await loadPlayers();
    await loadCoaches();
    await loadPools();
    await loadLineups();
    await loadMatchView();
    await loadGoalieStats();
    txt("playersTotal", players.length);
    txt("coachesTotal", coaches.length);
    txt("poolsTotal", pools.length);
    await subscribeRealtime();
  }

  return { init };
})();

window.addEventListener("DOMContentLoaded", () => {
  window.NSK2App.init().catch(err => {
    console.error(err);
    const el = document.getElementById("appError");
    if(el) el.textContent = err.message || "Kunde inte starta appen.";
  });
});
