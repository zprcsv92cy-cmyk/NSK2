window.NSK2App = (() => {

function byId(id){ return document.getElementById(id); }

function esc(s){
  return String(s ?? "").replace(/[&<>"]/g,m=>(
    { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m]
  ));
}

function setText(id,text){
  const el = byId(id);
  if(el) el.textContent = text || "";
}

let truppenRealtime=null;
let globalClicksBound=false;

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
  globalClicksBound=true;

  document.addEventListener("click", async e=>{

    const t=e.target;
    if(!(t instanceof HTMLElement)) return;

    try{

      if(t.dataset.editPool){
        sessionStorage.setItem("nsk2_edit_pool_id",t.dataset.editPool);
        window.location.href="../skapapoolspel/";
      }

      if(t.dataset.deletePool){
        const ok=window.confirm("Ta bort poolspelet?");
        if(!ok) return;
        await DB.deletePool(t.dataset.deletePool);
        window.location.reload();
      }

      if(t.dataset.poolId && t.dataset.lagNo){
        sessionStorage.setItem("nsk2_pool_id",t.dataset.poolId);
        sessionStorage.setItem("nsk2_lag_nr",t.dataset.lagNo);
        window.location.href="../laguppstallning/";
      }

    }catch(err){
      setText("appError",err.message||String(err));
    }

  });

}

async function initStartsidaPage(){

  const box=byId("savedPoolsList");
  if(!box) return;

  const pools=await DB.listPools();

  if(!pools.length){
    box.innerHTML='<div class="listrow">Inga sparade poolspel ännu.</div>';
    return;
  }

  box.innerHTML=pools.map(p=>{

    const teams=parseInt(p.teams||"2",10);

    const lagBtns=Array.from({length:teams},(_,i)=>{

      const lag=i+1;

      return `<button class="team-btn" data-pool-id="${p.id}" data-lag-no="${lag}">Lag ${lag}</button>`;

    }).join("");

    return `
    <article class="pool-item">

      <div class="pool-top">
        <div>
          <div class="pool-title">${esc(p.place||"Ort")} • ${esc(p.pool_date||"Datum")}</div>
          <div class="pool-meta">${esc(p.title||"Poolspel")}</div>
        </div>
        <div class="status-badge">${esc(p.status||"Aktiv")}</div>
      </div>

      <div class="row-actions">
        <button class="row-btn" data-edit-pool="${p.id}">Redigera</button>
        <button class="row-btn danger" data-delete-pool="${p.id}">Ta bort</button>
      </div>

      <div class="pool-lineup-block">
        <div class="pool-lineup-title">Laguppställning</div>
        <div class="team-buttons">${lagBtns}</div>
      </div>

    </article>`;
  }).join("");

}

async function initSkapaPoolspelPage(){

  const saveBtn=byId("savePool");
  if(!saveBtn) return;

  saveBtn.addEventListener("click",savePool);

}

async function savePool(){

  const payload={

    title:"Poolspel",
    place:byId("poolPlace")?.value||"",
    pool_date:byId("poolDate")?.value||null,
    status:"Aktiv",

    teams:parseInt(byId("teams")?.value||"2"),
    matches:parseInt(byId("matches")?.value||"4"),
    players_on_field:parseInt(byId("players")?.value||"3"),

    periods:parseInt(byId("periods")?.value||"1"),
    period_time:parseInt(byId("periodTime")?.value||"15"),
    sub_time:parseInt(byId("subTime")?.value||"90")

  };

  await DB.addPool(payload);

  window.location.href="../startsida/";

}

async function initLaguppstallningPage(){

  const box=byId("laguppstallningTeamButtons");
  if(!box) return;

  const poolId=sessionStorage.getItem("nsk2_pool_id");

  const pool=await DB.getPool(poolId);

  const teams=parseInt(pool.teams||2);
  const matches=parseInt(pool.matches||4);

  renderLagButtons(teams);
  renderMatchOptions(matches);
  renderPlayerCountOptions(pool.players_on_field||3);

  await renderSelectors();

  byId("saveLagMatchBtn")?.addEventListener("click",saveLineup);

}

function renderLagButtons(teams){

  const box=byId("laguppstallningTeamButtons");
  box.innerHTML="";

  for(let i=1;i<=teams;i++){

    const b=document.createElement("button");

    b.className="team-btn";
    b.textContent=`Lag ${i}`;

    b.onclick=()=>{

      sessionStorage.setItem("nsk2_lag_nr",i);
      fillMatch();

    };

    box.appendChild(b);

  }

}

function renderMatchOptions(matches){

  const sel=byId("lineupMatch");
  sel.innerHTML="";

  for(let i=1;i<=matches;i++){

    const o=document.createElement("option");
    o.value=i;
    o.textContent=`Match ${i}`;

    sel.appendChild(o);

  }

}

function renderPlayerCountOptions(def){

  const sel=byId("lineupPlayerCount");
  sel.innerHTML="";

  for(let i=1;i<=25;i++){

    const o=document.createElement("option");
    o.value=i;
    o.textContent=i;

    if(i==def) o.selected=true;

    sel.appendChild(o);

  }

}

async function renderSelectors(){

  const box=byId("lineupSelectors");
  if(!box) return;

  const players=await DB.listPlayers();
  const coaches=await DB.listCoaches();

  const playerOptions=['<option value="">Välj spelare</option>']
  .concat(players.map(p=>`<option value="${p.id}">${esc(p.full_name)}</option>`))
  .join("");

  const coachOptions=coaches.map(c=>`<option value="${c.id}">${esc(c.full_name)}</option>`).join("");

  let html=`
  <label>Målvakt</label>
  <select id="lineupGoalie">${playerOptions}</select>

  <label>Tränare</label>
  <select id="lineupCoach" multiple>${coachOptions}</select>
  `;

  for(let i=1;i<=25;i++){

    html+=`
    <label data-player-label="${i}">Spelare ${i}</label>
    <select id="lineupPlayer${i}">${playerOptions}</select>
    `;

  }

  box.innerHTML=html;

}

async function saveLineup(){

  const poolId=sessionStorage.getItem("nsk2_pool_id");
  const lagNo=sessionStorage.getItem("nsk2_lag_nr")||1;
  const matchNo=byId("lineupMatch").value;

  const goalie=byId("lineupGoalie").value;

  const count=parseInt(byId("lineupPlayerCount").value);

  const players=[];

  for(let i=1;i<=count;i++){

    const v=byId(`lineupPlayer${i}`).value;

    if(v){

      if(v===goalie){
        alert("Målvakt kan inte vara spelare");
        return;
      }

      if(players.includes(v)){
        alert("Spelare vald två gånger");
        return;
      }

      players.push(v);

    }

  }

  const coachSel=byId("lineupCoach");

  const coaches=[...coachSel.selectedOptions].map(o=>o.value);

  const match=await DB.savePoolTeamMatchConfig({

    pool_id:poolId,
    lag_no:parseInt(lagNo),
    match_no:parseInt(matchNo),

    start_time:byId("lineupStartTime")?.value||null,
    opponent:byId("lineupOpponent")?.value||"",
    plan:byId("lineupPlan")?.value||"Plan 1",

    player_count:count,
    goalie_player_id:goalie

  });

  await DB.saveLineup(match.id,players,coaches);

  setText("lineupMsg","Sparat");

}

async function initTruppenPage(){

  const list=byId("playersList");
  if(!list) return;

  const players=await DB.listPlayers();

  list.innerHTML=players.map(p=>`
  <div class="listrow">${esc(p.full_name)}</div>
  `).join("");

}

async function initGoalieStatsPage(){

  const list=byId("goalieStatsList");
  if(!list) return;

  const stats=await DB.listGoalieStats();

  list.innerHTML=stats.map(s=>`
  <div class="listrow">${esc(s.goalie_name)}</div>
  `).join("");

}

return {init};

})();

window.addEventListener("DOMContentLoaded",()=>{
  window.NSK2App.init();
});