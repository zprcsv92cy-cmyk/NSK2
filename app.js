window.NSK2App = (() => {

function byId(id){ return document.getElementById(id); }

function esc(s){
  return String(s ?? "").replace(/[&<>"]/g,m=>(
    { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m]
  ));
}

function setText(id,text){
  const el=byId(id);
  if(el) el.textContent=text||"";
}

let truppenRealtime=null;

/* =========================
INIT
========================= */

async function init(){

  if(window.Auth?.init) await Auth.init();

  await initStartsidaPage();
  initSkapaPoolspelPage();
  await initTruppenPage();
  await initGoalieStatsPage();

}

/* =========================
STARTSIDA
========================= */

async function initStartsidaPage(){

  const box=byId("savedPoolsList");
  if(!box) return;

  try{

    const pools=await DB.listPools();

    if(!pools.length){
      box.innerHTML='<div class="listrow">Inga sparade poolspel ännu.</div>';
      return;
    }

    box.innerHTML=pools.map(p=>`

      <article class="pool-item">
        <div class="pool-top">
          <div>
            <div class="pool-title">${esc(p.place||"Ort")} • ${esc(p.pool_date||"Datum")}</div>
            <div class="pool-meta">${esc(p.title||"Poolspel")}</div>
          </div>
          <div class="status-badge">${esc(p.status||"Aktiv")}</div>
        </div>
      </article>

    `).join("");

  }catch(err){
    setText("appError",err.message||String(err));
  }

}

/* =========================
SKAPA POOLSPEL
========================= */

function initSkapaPoolspelPage(){

  const saveBtn=byId("savePool");
  const teamsSel=byId("teams");

  if(!saveBtn||!teamsSel) return;

  renderTeamButtons();

  teamsSel.addEventListener("change",renderTeamButtons);
  saveBtn.addEventListener("click",savePool);

}

function renderTeamButtons(){

  const teams=parseInt(byId("teams")?.value||"2",10);
  const box=byId("teamButtons");

  if(!box) return;

  box.innerHTML="";

  for(let i=1;i<=teams;i++){

    const btn=document.createElement("button");
    btn.className="team-btn";
    btn.textContent=`Lag ${i}`;
    box.appendChild(btn);

  }

}

async function savePool(){

  try{

    const payload={
      title:"Poolspel",
      place:byId("poolPlace")?.value?.trim()||"",
      pool_date:byId("poolDate")?.value||null,
      status:"Aktiv",

      teams:parseInt(byId("teams")?.value||"2",10),
      matches:parseInt(byId("matches")?.value||"4",10),
      players_on_field:parseInt(byId("players")?.value||"3",10),
      periods:parseInt(byId("periods")?.value||"1",10),
      period_time:parseInt(byId("periodTime")?.value||"15",10),
      sub_time:parseInt(byId("subTime")?.value||"90",10)
    };

    await DB.addPool(payload);

    setText("poolMsg","Poolspel sparat");

    window.location.href="../startsida/";

  }catch(err){

    setText("appError",err.message||String(err));

  }

}

/* =========================
TRUPPEN
========================= */

function rowHtml(item,type){

return`

<div class="person-row">

<input class="inline-name-input"
value="${esc(item.full_name)}"
data-inline-${type}="${item.id}">

<div class="row-actions">

<button class="row-btn"
data-save-${type}="${item.id}">
Spara
</button>

<button class="row-btn danger"
data-delete-${type}="${item.id}">
Ta bort
</button>

</div>

</div>

`;

}

async function renderPlayers(){

  const list=byId("playersList");
  if(!list) return;

  const players=await DB.listPlayers();

  list.innerHTML=players.length
  ?players.map(p=>rowHtml(p,"player")).join("")
  :'<div class="muted-note">Inga spelare ännu.</div>';

}

async function renderCoaches(){

  const list=byId("coachesList");
  if(!list) return;

  const coaches=await DB.listCoaches();

  list.innerHTML=coaches.length
  ?coaches.map(c=>rowHtml(c,"coach")).join("")
  :'<div class="muted-note">Inga tränare ännu.</div>';

}

async function addPlayer(){

  const input=byId("playerInput");
  const name=input?.value?.trim();
  if(!name) return;

  await DB.addPlayer(name);
  input.value="";

  await renderPlayers();

}

async function addCoach(){

  const input=byId("coachInput");
  const name=input?.value?.trim();
  if(!name) return;

  await DB.addCoach(name);
  input.value="";

  await renderCoaches();

}

async function saveInlinePlayer(id){

  const el=document.querySelector(`[data-inline-player="${id}"]`);
  if(!el) return;

  await DB.updatePlayer(id,el.value.trim());
  await renderPlayers();

}

async function saveInlineCoach(id){

  const el=document.querySelector(`[data-inline-coach="${id}"]`);
  if(!el) return;

  await DB.updateCoach(id,el.value.trim());
  await renderCoaches();

}

async function deletePlayer(id){

  await DB.deletePlayer(id);
  await renderPlayers();

}

async function deleteCoach(id){

  await DB.deleteCoach(id);
  await renderCoaches();

}

async function initTruppenPage(){

  if(!byId("playersList")&&!byId("coachesList")) return;

  byId("addPlayerBtn")?.addEventListener("click",addPlayer);
  byId("addCoachBtn")?.addEventListener("click",addCoach);

  document.addEventListener("click",async e=>{

    const t=e.target;
    if(!(t instanceof HTMLElement)) return;

    if(t.dataset.savePlayer) await saveInlinePlayer(t.dataset.savePlayer);
    if(t.dataset.saveCoach) await saveInlineCoach(t.dataset.saveCoach);

    if(t.dataset.deletePlayer) await deletePlayer(t.dataset.deletePlayer);
    if(t.dataset.deleteCoach) await deleteCoach(t.dataset.deleteCoach);

  });

  await renderPlayers();
  await renderCoaches();

  if(!truppenRealtime){

    truppenRealtime=await DB.subscribeTruppen(async type=>{

      if(type==="players") await renderPlayers();
      if(type==="coaches") await renderCoaches();

    });

  }

}

/* =========================
GOALIE STATS
========================= */

async function initGoalieStatsPage(){

  const list=byId("goalieStatsList");
  if(!list) return;

  const stats=await DB.listGoalieStats();

  const grouped={};

  stats.forEach(row=>{
    const name=row.goalie_name||"Okänd";
    if(!grouped[name]) grouped[name]=new Set();
    grouped[name].add(row.match_id);
  });

  const rows=Object.entries(grouped)
  .map(([name,set])=>({name,count:set.size}))
  .sort((a,b)=>b.count-a.count);

  list.innerHTML=rows.map(r=>`
  <div class="listrow">
  <strong>${esc(r.name)}</strong> — ${r.count} matcher
  </div>
  `).join("");

}

return{init};

})();

window.addEventListener("DOMContentLoaded",()=>{
  window.NSK2App.init();
});