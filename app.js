// app.js patch — truppen NSK layout + redigera / ta bort
(function(){
  if(!window.NSK2App) return;

  function byId(id){ return document.getElementById(id); }
  function esc(s){
    return String(s ?? "").replace(/[&<>"]/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m]));
  }
  function setMsg(id, txt){
    const el = byId(id);
    if(el) el.textContent = txt || "";
  }

  let truppenPlayers = [];
  let truppenCoaches = [];
  let truppenBound = false;

  async function renderPlayers(){
    if(!window.DB?.listPlayers) return;
    truppenPlayers = await window.DB.listPlayers();
    const el = byId("playersList");
    if(!el) return;

    el.innerHTML = truppenPlayers.length ? truppenPlayers.map(p => `
      <div class="person-row">
        <div class="person-name">${esc(p.full_name)}</div>
        <div class="row-actions">
          <button class="row-btn" data-edit-player="${p.id}">Redigera</button>
          <button class="row-btn danger" data-delete-player="${p.id}">Ta bort</button>
        </div>
      </div>
    `).join("") : '<div class="muted-note">Inga spelare ännu.</div>';
  }

  async function renderCoaches(){
    if(!window.DB?.listCoaches) return;
    truppenCoaches = await window.DB.listCoaches();
    const el = byId("coachesList");
    if(!el) return;

    el.innerHTML = truppenCoaches.length ? truppenCoaches.map(c => `
      <div class="person-row">
        <div class="person-name">${esc(c.full_name)}</div>
        <div class="row-actions">
          <button class="row-btn" data-edit-coach="${c.id}">Redigera</button>
          <button class="row-btn danger" data-delete-coach="${c.id}">Ta bort</button>
        </div>
      </div>
    `).join("") : '<div class="muted-note">Inga tränare ännu.</div>';
  }

  async function addPlayerTruppen(){
    const input = byId("playerInput");
    const name = input?.value?.trim();
    if(!name) return setMsg("playersMsg", "Skriv ett namn.");
    await window.DB.addPlayer(name);
    input.value = "";
    setMsg("playersMsg", "Spelare sparad.");
    await renderPlayers();
  }

  async function addCoachTruppen(){
    const input = byId("coachInput");
    const name = input?.value?.trim();
    if(!name) return setMsg("coachesMsg", "Skriv ett namn.");
    await window.DB.addCoach(name);
    input.value = "";
    setMsg("coachesMsg", "Tränare sparad.");
    await renderCoaches();
  }

  async function editPlayerTruppen(id){
    const current = truppenPlayers.find(x => x.id === id);
    const next = prompt("Redigera spelare", current?.full_name || "");
    if(!next || !next.trim()) return;
    await window.DB.updatePlayer(id, next.trim());
    setMsg("playersMsg", "Spelare uppdaterad.");
    await renderPlayers();
  }

  async function editCoachTruppen(id){
    const current = truppenCoaches.find(x => x.id === id);
    const next = prompt("Redigera tränare", current?.full_name || "");
    if(!next || !next.trim()) return;
    await window.DB.updateCoach(id, next.trim());
    setMsg("coachesMsg", "Tränare uppdaterad.");
    await renderCoaches();
  }

  async function deletePlayerTruppen(id){
    if(!confirm("Ta bort spelaren?")) return;
    await window.DB.deletePlayer(id);
    setMsg("playersMsg", "Spelare borttagen.");
    await renderPlayers();
  }

  async function deleteCoachTruppen(id){
    if(!confirm("Ta bort tränaren?")) return;
    await window.DB.deleteCoach(id);
    setMsg("coachesMsg", "Tränare borttagen.");
    await renderCoaches();
  }

  function bindTruppen(){
    if(truppenBound) return;
    truppenBound = true;

    byId("addPlayerBtn")?.addEventListener("click", addPlayerTruppen);
    byId("addCoachBtn")?.addEventListener("click", addCoachTruppen);

    document.addEventListener("click", async (e) => {
      const t = e.target;
      if(!(t instanceof HTMLElement)) return;

      try{
        if(t.dataset.editPlayer) await editPlayerTruppen(t.dataset.editPlayer);
        if(t.dataset.deletePlayer) await deletePlayerTruppen(t.dataset.deletePlayer);
        if(t.dataset.editCoach) await editCoachTruppen(t.dataset.editCoach);
        if(t.dataset.deleteCoach) await deleteCoachTruppen(t.dataset.deleteCoach);
      }catch(err){
        const errorBox = byId("appError");
        if(errorBox) errorBox.textContent = err.message || String(err);
      }
    });
  }

  const oldInit = window.NSK2App.init;
  window.NSK2App.init = async function(){
    if(oldInit) await oldInit();
    if(!byId("playersList") && !byId("coachesList")) return;
    bindTruppen();
    await renderPlayers();
    await renderCoaches();
  };
})();
