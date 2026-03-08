// NSK2 app.js V3 (Supabase version)
window.NSK2App = (() => {
  let players = [];
  let coaches = [];
  let pools = [];
  let currentMatchId = null;

  function byId(id){ return document.getElementById(id); }

  async function loadPlayers(){
    players = await DB.listPlayers();
    const el = byId("playersList");
    if(!el) return;
    el.innerHTML = players.map(p =>
      `<div class="person-row">
        <div class="person-name">${p.full_name}</div>
      </div>`
    ).join("");
    const c = byId("teamCount");
    if(c) c.textContent = players.length;
  }

  async function loadCoaches(){
    coaches = await DB.listCoaches();
    const el = byId("coachesList");
    if(!el) return;
    el.innerHTML = coaches.map(c =>
      `<div class="person-row">
        <div class="person-name">${c.full_name}</div>
      </div>`
    ).join("");
  }

  async function addPlayer(){
    const name = byId("playerInput")?.value?.trim();
    if(!name) return;
    await DB.addPlayer(name);
    byId("playerInput").value = "";
    await loadPlayers();
  }

  async function addCoach(){
    const name = byId("coachInput")?.value?.trim();
    if(!name) return;
    await DB.addCoach(name);
    byId("coachInput").value = "";
    await loadCoaches();
  }

  async function loadPools(){
    pools = await DB.listPools();
    const el = byId("savedPoolsList");
    if(!el) return;

    el.innerHTML = pools.map(p =>
      `<article class="pool-item">
        <div class="pool-title">${p.title}</div>
        <button data-open="${p.id}">Öppna</button>
      </article>`
    ).join("");
  }

  async function openPool(id){
    const matches = await DB.listMatchesByPool(id);

    if(matches.length){
      currentMatchId = matches[0].id;
    }else{
      const m = await DB.addMatch({pool_id:id,title:"Match"});
      currentMatchId = m.id;
    }

    sessionStorage.setItem("nsk2_current_match_id",currentMatchId);
    location.href="/NSK2/matchvy/";
  }

  async function loadLineups(){
    const id = sessionStorage.getItem("nsk2_current_match_id");
    if(!id) return;

    const lineups = await DB.listLineups(id);
    const el = byId("lineupList");
    if(!el) return;

    el.innerHTML = lineups.map(l=>
      `<div class="listrow">
        Byte ${l.lineup_no} – ${l.players.map(p=>p.full_name).join(", ")}
      </div>`
    ).join("");
  }

  async function generateLineups(){
    const id = sessionStorage.getItem("nsk2_current_match_id");
    if(!id) return;

    if(!players.length) players = await DB.listPlayers();

    const ids = players.map(p=>p.id);
    const lineups=[];

    for(let i=0;i<4;i++){
      lineups.push({
        lineup_no:i+1,
        player_ids:ids.slice(i*5,i*5+5)
      });
    }

    await DB.replaceLineups(id,lineups);
    await loadLineups();
  }

  async function init(){
    if(byId("addPlayerBtn")) byId("addPlayerBtn").onclick=addPlayer;
    if(byId("addCoachBtn")) byId("addCoachBtn").onclick=addCoach;
    if(byId("generateLineupsBtn")) byId("generateLineupsBtn").onclick=generateLineups;

    document.addEventListener("click",e=>{
      const id=e.target.dataset.open;
      if(id) openPool(id);
    });

    await loadPlayers();
    await loadCoaches();
    await loadPools();
    await loadLineups();
  }

  return {init};
})();

window.addEventListener("DOMContentLoaded",()=>NSK2App.init());
