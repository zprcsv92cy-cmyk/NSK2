
// app.js — NSK Team 18 (stable auth + realtime + safe loading)

window.NSK2App = (() => {

let players = [];
let coaches = [];
let pools = [];
let lineups = [];

function byId(id){ return document.getElementById(id); }
function esc(s){ return String(s ?? "").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m])); }

function txt(id,val){
  const el = byId(id);
  if(el) el.textContent = val ?? "";
}

async function safe(fn){
  try{
    return await fn();
  }catch(err){
    console.error(err);
    await new Promise(r=>setTimeout(r,300));
    return await fn();
  }
}

function activateMenu(){
  document.querySelectorAll(".mainmenu a").forEach(a=>{
    const href=a.getAttribute("href");
    if(href && location.pathname.startsWith(href)){
      a.classList.add("active");
    }
  });
}

async function loadPlayers(){

  players = await safe(()=>DB.listPlayers());

  const el = byId("playersList");

  if(!el) return;

  el.innerHTML = players.length
    ? players.map(p=>`
      <div class="person-row">
        <div class="person-name">${esc(p.full_name)}</div>
      </div>
    `).join("")
    : '<div class="muted-note">Inga spelare ännu.</div>';

  txt("playersTotal",players.length);
}

async function loadCoaches(){

  coaches = await safe(()=>DB.listCoaches());

  const el = byId("coachesList");

  if(!el) return;

  el.innerHTML = coaches.length
    ? coaches.map(c=>`
      <div class="person-row">
        <div class="person-name">${esc(c.full_name)}</div>
      </div>
    `).join("")
    : '<div class="muted-note">Inga tränare ännu.</div>';

  txt("coachesTotal",coaches.length);
}

async function loadPools(){

  pools = await safe(()=>DB.listPools());

  const el = byId("savedPoolsList");

  if(!el) return;

  el.innerHTML = pools.length
    ? pools.map(p=>`
      <article class="pool-item">
        <div class="pool-title">${esc(p.title)}</div>
        <button data-open="${p.id}">Öppna</button>
      </article>
    `).join("")
    : '<div class="listrow">Inga poolspel ännu.</div>';

}

async function openPool(id){

  const matches = await DB.listMatchesByPool(id);

  let matchId;

  if(matches.length){
    matchId = matches[0].id;
  }else{

    const m = await DB.addMatch({
      pool_id:id,
      title:"Match"
    });

    matchId = m.id;

  }

  sessionStorage.setItem("nsk2_current_match_id",matchId);

  location.href="/NSK2/matchvy/";

}

async function loadLineups(){

  const matchId = sessionStorage.getItem("nsk2_current_match_id");

  if(!matchId) return;

  lineups = await DB.listLineups(matchId);

  const el = byId("lineupList");

  if(!el) return;

  el.innerHTML = lineups.length
    ? lineups.map(l=>`
      <div class="listrow">
        Byte ${l.lineup_no} – ${l.players.map(p=>p.full_name).join(", ")}
      </div>
    `).join("")
    : '<div class="listrow">Inget bytesschema ännu.</div>';

}

async function subscribeRealtime(){

  const tables = [
    "nsk_players",
    "nsk_coaches",
    "nsk_pools",
    "nsk_matches",
    "nsk_lineups",
    "nsk_lineup_players"
  ];

  for(const t of tables){

    await DB.subscribe(t, async ()=>{

      if(t==="nsk_players") await loadPlayers();

      if(t==="nsk_coaches") await loadCoaches();

      if(t==="nsk_pools") await loadPools();

      if(t==="nsk_lineups" || t==="nsk_lineup_players"){
        await loadLineups();
      }

    });

  }

}

async function bind(){

  document.addEventListener("click",e=>{

    const id=e.target.dataset.open;

    if(id) openPool(id);

  });

}

async function init(){

  activateMenu();

  // VERY IMPORTANT
  await Auth.init();

  await bind();

  await loadPlayers();
  await loadCoaches();
  await loadPools();
  await loadLineups();

  await subscribeRealtime();

}

return { init };

})();


window.addEventListener("DOMContentLoaded",()=>{

  window.NSK2App.init().catch(err=>{

    console.error(err);

    const el=document.getElementById("appError");

    if(el) el.textContent=err.message;

  });

});
