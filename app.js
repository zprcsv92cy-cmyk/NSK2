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

let truppenRealtime = null;

/* =========================
INIT
========================= */

async function init(){
  if(window.Auth?.init) await Auth.init();

  bindGlobalClicks();

  await initStartsidaPage();
  await initSkapaPoolspelPage();
  await initTruppenPage();
  await initGoalieStatsPage();
}

/* =========================
GLOBAL CLICKS
========================= */

function bindGlobalClicks(){
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

      if(t.dataset.savePlayer){
        await saveInlinePlayer(t.dataset.savePlayer);
        return;
      }

      if(t.dataset.saveCoach){
        await saveInlineCoach(t.dataset.saveCoach);
        return;
      }

      if(t.dataset.deletePlayer){
        await deletePlayer(t.dataset.deletePlayer);
        return;
      }

      if(t.dataset.deleteCoach){
        await deleteCoach(t.dataset.deleteCoach);
        return;
      }
    }catch(err){
      setText("appError", err.message || String(err));
    }
  });
}

/* =========================
STARTSIDA
========================= */

async function initStartsidaPage(){

  const box = byId("savedPoolsList");
  if(!box) return;

  try{

    const pools = await DB.listPools();

    if(!pools.length){
      box.innerHTML = '<div class="listrow">Inga sparade poolspel ännu.</div>';
      return;
    }

    box.innerHTML = pools.map(p => `
      <article class="pool-item">
        <div class="pool-top">
          <div>
            <div class="pool-title">${esc(p.place || "Ort")} • ${esc(p.pool_date || "Datum")}</div>
            <div class="pool-meta">${esc(p.title || "Poolspel")}</div>
          </div>
          <div class="status-badge">${esc(p.status || "Aktiv")}</div>
        </div>

        <div class="row-actions" style="margin-top:12px">
          <button class="row-btn" data-edit-pool="${p.id}">Redigera</button>
          <button class="row-btn danger" data-delete-pool="${p.id}">Ta bort</button>
        </div>
      </article>
    `).join("");

  }catch(err){
    setText("appError", err.message || String(err));
  }
}

/* =========================
SKAPA POOLSPEL
========================= */

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

  for(let i=1;i<=teams;i++){
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

  for(let i=1;i<=teams;i++){
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
      place: byId("poolPlace")?.value?.trim