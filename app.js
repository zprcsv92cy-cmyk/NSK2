// app.js patch — NSK V14 Truppen UI (swipe, inline edit, drag, live sync)
(function(){
  if(!window.NSK2App) return;

  function byId(id){ return document.getElementById(id); }
  function esc(s){ return String(s ?? "").replace(/[&<>"]/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m])); }

  let players = [];
  let coaches = [];
  let truppenBound = false;
  let truppenSub = null;

  function setMsg(id, txt){
    const el = byId(id);
    if(el) el.textContent = txt || "";
  }

  function personRowHtml(item, type){
    return `
      <div class="swipe-wrap" data-swipe-wrap="${item.id}">
        <button class="swipe-delete-btn" data-delete-${type}="${item.id}">Ta bort</button>
        <div class="person-row draggable-row" draggable="true" data-id="${item.id}" data-type="${type}">
          <div class="drag-handle" title="Dra för att sortera">☰</div>
          <div class="person-main">
            <input class="inline-name-input" value="${esc(item.full_name)}" data-inline-${type}="${item.id}">
          </div>
          <div class="row-actions">
            <button class="row-btn" data-save-${type}="${item.id}">Spara</button>
            <button class="row-btn danger desktop-delete" data-delete-${type}="${item.id}">Ta bort</button>
          </div>
        </div>
      </div>
    `;
  }

  async function renderPlayers(){
    players = await window.DB.listPlayers();
    const el = byId("playersList");
    if(!el) return;
    el.innerHTML = players.length ? players.map(p => personRowHtml(p, "player")).join("") : '<div class="muted-note">Inga spelare ännu.</div>';
    bindSwipe(el);
    bindDrag(el, "player");
  }

  async function renderCoaches(){
    coaches = await window.DB.listCoaches();
    const el = byId("coachesList");
    if(!el) return;
    el.innerHTML = coaches.length ? coaches.map(c => personRowHtml(c, "coach")).join("") : '<div class="muted-note">Inga tränare ännu.</div>';
    bindSwipe(el);
    bindDrag(el, "coach");
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

  function getInlineValue(type, id){
    const el = document.querySelector(`[data-inline-${type}="${id}"]`);
    return el ? el.value.trim() : "";
  }

  async function saveInlinePlayer(id){
    const next = getInlineValue("player", id);
    if(!next) return;
    await window.DB.updatePlayer(id, next);
    setMsg("playersMsg", "Spelare uppdaterad.");
    await renderPlayers();
  }

  async function saveInlineCoach(id){
    const next = getInlineValue("coach", id);
    if(!next) return;
    await window.DB.updateCoach(id, next);
    setMsg("coachesMsg", "Tränare uppdaterad.");
    await renderCoaches();
  }

  async function deletePlayerTruppen(id){
    await window.DB.deletePlayer(id);
    setMsg("playersMsg", "Spelare borttagen.");
    await renderPlayers();
  }

  async function deleteCoachTruppen(id){
    await window.DB.deleteCoach(id);
    setMsg("coachesMsg", "Tränare borttagen.");
    await renderCoaches();
  }

  function bindSwipe(root){
    root.querySelectorAll(".person-row").forEach(row => {
      let startX = 0;
      let currentX = 0;
      let dragging = false;
      const wrap = row.parentElement;

      row.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
        currentX = startX;
        dragging = true;
      }, { passive:true });

      row.addEventListener("touchmove", e => {
        if(!dragging) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        if(diff < -40) wrap.classList.add("swiped");
        if(diff > 30) wrap.classList.remove("swiped");
      }, { passive:true });

      row.addEventListener("touchend", () => {
        dragging = false;
      });
    });
  }

  function bindDrag(root, type){
    const rows = Array.from(root.querySelectorAll(".draggable-row"));
    rows.forEach(row => {
      row.addEventListener("dragstart", () => {
        row.classList.add("dragging");
      });
      row.addEventListener("dragend", async () => {
        row.classList.remove("dragging");
        const ids = Array.from(root.querySelectorAll(".draggable-row")).map(r => r.dataset.id);
        try{
          if(type === "player" && window.DB.savePlayerOrder) await window.DB.savePlayerOrder(ids);
          if(type === "coach" && window.DB.saveCoachOrder) await window.DB.saveCoachOrder(ids);
        }catch(err){
          const errorBox = byId("appError");
          if(errorBox) errorBox.textContent = err.message || String(err);
        }
      });
    });

    root.addEventListener("dragover", e => {
      e.preventDefault();
      const after = getDragAfterElement(root, e.clientY);
      const dragging = root.querySelector(".dragging");
      if(!dragging) return;
      const wrap = dragging.parentElement;
      if(after == null){
        root.appendChild(wrap);
      }else{
        root.insertBefore(wrap, after.parentElement);
      }
    });
  }

  function getDragAfterElement(container, y){
    const els = [...container.querySelectorAll(".draggable-row:not(.dragging)")];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if(offset < 0 && offset > closest.offset){
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  async function bindTruppen(){
    if(truppenBound) return;
    truppenBound = true;

    byId("addPlayerBtn")?.addEventListener("click", addPlayerTruppen);
    byId("addCoachBtn")?.addEventListener("click", addCoachTruppen);

    document.addEventListener("keydown", async (e) => {
      const t = e.target;
      if(!(t instanceof HTMLInputElement)) return;
      if(e.key !== "Enter") return;
      try{
        if(t.dataset.inlinePlayer) await saveInlinePlayer(t.dataset.inlinePlayer);
        if(t.dataset.inlineCoach) await saveInlineCoach(t.dataset.inlineCoach);
      }catch(err){
        const errorBox = byId("appError");
        if(errorBox) errorBox.textContent = err.message || String(err);
      }
    });

    document.addEventListener("click", async (e) => {
      const t = e.target;
      if(!(t instanceof HTMLElement)) return;
      try{
        if(t.dataset.savePlayer) await saveInlinePlayer(t.dataset.savePlayer);
        if(t.dataset.saveCoach) await saveInlineCoach(t.dataset.saveCoach);
        if(t.dataset.deletePlayer) await deletePlayerTruppen(t.dataset.deletePlayer);
        if(t.dataset.deleteCoach) await deleteCoachTruppen(t.dataset.deleteCoach);
      }catch(err){
        const errorBox = byId("appError");
        if(errorBox) errorBox.textContent = err.message || String(err);
      }
    });
  }

  async function bindRealtime(){
    if(truppenSub || !window.DB.subscribeTruppen) return;
    truppenSub = await window.DB.subscribeTruppen(async (type) => {
      if(type === "players") await renderPlayers();
      if(type === "coaches") await renderCoaches();
    });
  }

  const oldInit = window.NSK2App.init;
  window.NSK2App.init = async function(){
    if(oldInit) await oldInit();
    if(!byId("playersList") && !byId("coachesList")) return;
    await bindTruppen();
    await renderPlayers();
    await renderCoaches();
    await bindRealtime();
  };
})();
