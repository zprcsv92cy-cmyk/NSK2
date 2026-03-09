window.NSK2App = (() => {

  function byId(id){ return document.getElementById(id); }

  function esc(s){
    return String(s ?? "").replace(/[&<>"]/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m]));
  }

  async function loadPlayers(){
    const players = await DB.listPlayers();
    const el = byId("playersList");
    if(!el) return;

    el.innerHTML = players.map(p=>`
      <div class="person-row">
        <div class="person-name">${esc(p.full_name)}</div>
      </div>
    `).join("");
  }

  async function loadCoaches(){
    const coaches = await DB.listCoaches();
    const el = byId("coachesList");
    if(!el) return;

    el.innerHTML = coaches.map(c=>`
      <div class="person-row">
        <div class="person-name">${esc(c.full_name)}</div>
      </div>
    `).join("");
  }

  async function addPlayer(){
    const input = byId("playerInput");
    if(!input?.value) return;

    await DB.addPlayer(input.value.trim());
    input.value = "";
    await loadPlayers();
  }

  async function addCoach(){
    const input = byId("coachInput");
    if(!input?.value) return;

    await DB.addCoach(input.value.trim());
    input.value = "";
    await loadCoaches();
  }

  async function init(){
    if(window.Auth?.init) await Auth.init();

    byId("addPlayerBtn")?.addEventListener("click",addPlayer);
    byId("addCoachBtn")?.addEventListener("click",addCoach);

    await loadPlayers();
    await loadCoaches();
  }

  return { init };

})();

window.addEventListener("DOMContentLoaded",()=>NSK2App.init());
