// app.js — NSK Team 18 V11 (Auth-safe + stable loading + realtime)

window.NSK2App = (() => {
  let players = [];
  let coaches = [];
  let pools = [];
  let lineups = [];
  let timerHandle = null;
  let timerElapsed = 0;

  function byId(id){ return document.getElementById(id); }
  function esc(s){ return String(s ?? "").replace(/[&<>\"]/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;" }[m] || m)); }
  function txt(id, value){ const el = byId(id); if(el) el.textContent = value ?? ""; }
  function html(id, value){ const el = byId(id); if(el) el.innerHTML = value ?? ""; }
  function val(id){ return byId(id)?.value?.trim?.() || ""; }
  function mmss(total){ const m=String(Math.floor(total/60)).padStart(2,"0"); const s=String(total%60).padStart(2,"0"); return `${m}:${s}`; }

  async function ensureAuthReady(){
    if(!window.Auth) window.Auth = {};
    if(typeof Auth.init !== "function") {
      Auth.init = async () => true;
    }
    if(typeof Auth.getClient !== "function"){
      throw new Error("Auth.getClient saknas i auth.js");
    }
    await Auth.init();
  }

  async function safe(fn, retries = 2){
    let lastErr;
    for(let i=0;i<=retries;i++){
      try{
        return await fn();
      }catch(err){
        lastErr = err;
        console.error(err);
        await new Promise(r => setTimeout(r, 350));
      }
    }
    throw lastErr;
  }

  function activateMenu(){
    document.querySelectorAll(".mainmenu a").forEach(a => {
      const href = a.getAttribute("href");
      if(href && location.pathname.startsWith(href)) a.classList.add("active");
    });
  }

  async function loadPlayers(){
  const errorBox = byId("appError");
  try{
    const teamId = await DB.getTeamId();
    players = await safe(() => DB.listPlayers());
    if(errorBox) errorBox.textContent = `teamId=${teamId} spelare=${players.length}`;
  }catch(err){
    console.error(err);
    if(errorBox) errorBox.textContent = "Spelare-fel: " + (err.message || String(err));
    return;
  }

  const el = byId("playersList");
  if(!el) return;

  el.innerHTML = players.length ? players.map(p => `
    <div class="person-row">
      <div class="person-name">${esc(p.full_name)}</div>
    </div>
  `).join("") : '<div class="muted-note">Inga spelare ännu.</div>';
  }

  async function loadCoaches(){
  const errorBox = byId("appError");
  try{
    coaches = await safe(() => DB.listCoaches());
    if(errorBox) errorBox.textContent += ` | tränare=${coaches.length}`;
  }catch(err){
    console.error(err);
    if(errorBox) errorBox.textContent = "Tränare-fel: " + (err.message || String(err));
    return;
  }

  const el = byId("coachesList");
  if(!el) return;

  el.innerHTML = coaches.length ? coaches.map(c => `
    <div class="person-row">
      <div class="person-name">${esc(c.full_name)}</div>
    </div>
  `).join("") : '<div class="muted-note">Inga tränare ännu.</div>';
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

  async function deletePlayer(id){
    await DB.deletePlayer(id);
    await loadPlayers();
  }

  async function loadPools(){
    pools = await safe(() => DB.listPools());

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

    txt("poolsTotal", pools.length);
  }

  async function addPool(){
    const title = val("poolName");
    const place = val("poolPlace");
    const pool_date = byId("poolDate")?.value || null;
    if(!title) return txt("poolMsg", "Skriv namn på poolspelet.");
    await DB.addPool({ title, place, pool_date, status: "Aktiv" });
    ["poolName","poolPlace","poolDate"].forEach(id => { const el = byId(id); if(el) el.value = ""; });
    txt("poolMsg", "Poolspel sparat.");
    await loadPools();
  }

  async function openPool(id){
    const matches = await DB.listMatchesByPool(id);
    let matchId;
    if(matches.length){
      matchId = matches[0].id;
    } else {
      const m = await DB.addMatch({
        pool_id: id,
        title: "Match",
        opponent: "",
        place: "",
        match_time: "",
        status: "Kommande",
        active_lineup_index: 0,
        shift_seconds: 90
      });
      matchId = m.id;
    }
    sessionStorage.setItem("nsk2_current_match_id", matchId);
    location.href = "/NSK2/matchvy/";
  }

  async function loadLineups(){
    const matchId = sessionStorage.getItem("nsk2_current_match_id");
    if(!matchId || !DB.listLineups) return;

    lineups = await safe(() => DB.listLineups(matchId));
    const el = byId("lineupList");
    if(!el) return;

    el.innerHTML = lineups.length ? lineups.map(l => `
      <div class="listrow">
        Byte ${l.lineup_no} – ${(l.players || []).map(p => p.full_name).join(", ")}
      </div>
    `).join("") : '<div class="listrow">Inget bytesschema ännu.</div>';
  }

  async function loadMatchView(){
    const matchId = sessionStorage.getItem("nsk2_current_match_id");
    if(!matchId || !DB.listMatchesByPool) return;

    let match = null;
    for(const p of pools){
      const matches = await DB.listMatchesByPool(p.id);
      const found = matches.find(m => m.id === matchId);
      if(found){ match = found; break; }
    }
    if(!match) return;

    if(byId("matchTitle")) byId("matchTitle").value = match.title || "";
    if(byId("matchOpponent")) byId("matchOpponent").value = match.opponent || "";
    if(byId("matchPlace")) byId("matchPlace").value = match.place || "";
    if(byId("matchTime")) byId("matchTime").value = match.match_time || "";
    if(byId("matchShiftSeconds")) byId("matchShiftSeconds").value = match.shift_seconds || 90;

    if(DB.listLineups){
      lineups = await DB.listLineups(matchId);
      const idx = Number(match.active_lineup_index || 0);
      const current = lineups[idx] || { players: [] };
      const next = lineups[(idx + 1) % Math.max(1, lineups.length)] || { players: [] };
      txt("shiftLabel", lineups.length ? `Byte ${idx + 1} / ${lineups.length}` : "Inget schema");
      txt("currentPlayers", current.players.map(p => p.full_name).join(" • ") || "—");
      txt("nextPlayers", next.players.map(p => p.full_name).join(" • ") || "—");
    }
  }

  async function nextShift(){
    const matchId = sessionStorage.getItem("nsk2_current_match_id");
    if(!matchId || !DB.updateMatch) return;
    let match = null;
    for(const p of pools){
      const matches = await DB.listMatchesByPool(p.id);
      const found = matches.find(m => m.id === matchId);
      if(found){ match = found; break; }
    }
    if(!match) return;
    const next = lineups.length ? ((Number(match.active_lineup_index || 0) + 1) % lineups.length) : 0;
    await DB.updateMatch(matchId, { active_lineup_index: next });
    await loadMatchView();
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
    if(!DB.subscribe) return;
    const tables = ["nsk_players","nsk_coaches","nsk_pools","nsk_matches","nsk_lineups","nsk_lineup_players"];
    for(const t of tables){
      await DB.subscribe(t, async () => {
        if(t === "nsk_players") await loadPlayers();
        if(t === "nsk_coaches") await loadCoaches();
        if(t === "nsk_pools") await loadPools();
        if(t === "nsk_matches" || t === "nsk_lineups" || t === "nsk_lineup_players"){
          await loadLineups();
          await loadMatchView();
        }
      });
    }
  }

  async function bind(){
    byId("addPlayerBtn")?.addEventListener("click", addPlayer);
    byId("addCoachBtn")?.addEventListener("click", addCoach);
    byId("savePoolBtn")?.addEventListener("click", addPool);
    byId("startTimerBtn")?.addEventListener("click", startTimer);
    byId("stopTimerBtn")?.addEventListener("click", stopTimer);
    byId("nextShiftBtn")?.addEventListener("click", nextShift);
    byId("coachFullscreenBtn")?.addEventListener("click", () => document.body.classList.toggle("coach-fullscreen"));

    document.addEventListener("click", e => {
      const t = e.target;
      if(!(t instanceof HTMLElement)) return;
      if(t.dataset.openPool) openPool(t.dataset.openPool);
      if(t.dataset.deletePlayer) deletePlayer(t.dataset.deletePlayer);
    });
  }

  async function init(){
    activateMenu();
    await ensureAuthReady();
    await bind();
    await loadPlayers();
    await loadCoaches();
    await loadPools();
    await loadLineups();
    await loadMatchView();
    await subscribeRealtime();
  }

  return { init };
})();

window.addEventListener("DOMContentLoaded", () => {
  window.NSK2App.init().catch(err => {
    console.error(err);
    const el = document.getElementById("appError");
    if(el) el.textContent = err.message || String(err);
  });
});
