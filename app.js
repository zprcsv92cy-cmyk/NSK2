window.NSK2App = (() => {

  function byId(id){ return document.getElementById(id); }

  function esc(s){
    return String(s ?? "").replace(/[&<>"]/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m]));
  }

  function setText(id, text){
    const el = byId(id);
    if(el) el.textContent = text ?? "";
  }

  async function loadPlayers(){
    const players = await DB.listPlayers();
    const el = byId("playersList");
    if(!el) return;

    el.innerHTML = players.length
      ? players.map(p => `
        <div class="person-row">
          <div class="person-name">${esc(p.full_name)}</div>
        </div>
      `).join("")
      : '<div class="muted-note">Inga spelare ännu.</div>';
  }

  async function loadCoaches(){
    const coaches = await DB.listCoaches();
    const el = byId("coachesList");
    if(!el) return;

    el.innerHTML = coaches.length
      ? coaches.map(c => `
        <div class="person-row">
          <div class="person-name">${esc(c.full_name)}</div>
        </div>
      `).join("")
      : '<div class="muted-note">Inga tränare ännu.</div>';
  }

  async function addPlayer(){
    const input = byId("playerInput");
    if(!input?.value?.trim()) return;
    await DB.addPlayer(input.value.trim());
    input.value = "";
    await loadPlayers();
    await renderDebug();
  }

  async function addCoach(){
    const input = byId("coachInput");
    if(!input?.value?.trim()) return;
    await DB.addCoach(input.value.trim());
    input.value = "";
    await loadCoaches();
    await renderDebug();
  }

  async function renderDebug(){
    const box = byId("appError");
    const debug = byId("debugBox");
    if(!box && !debug) return;

    const parts = [];

    try{
      const authInfo = await Auth.getDebugInfo();
      parts.push("AUTH");
      parts.push("supabase-lib: " + (authInfo.hasSupabaseLib ? "ok" : "saknas"));
      parts.push("config: " + (authInfo.hasConfig ? "ok" : "saknas"));
      parts.push("url: " + (authInfo.hasUrl ? "ok" : "saknas"));
      parts.push("key: " + (authInfo.hasKey ? "ok" : "saknas"));
      parts.push("user: " + (authInfo.sessionUser || "ingen session"));
      if(authInfo.authError) parts.push("auth-fel: " + authInfo.authError);
    }catch(err){
      parts.push("AUTH FEL: " + (err.message || String(err)));
    }

    try{
      const dbInfo = await DB.getDebugInfo();
      parts.push("");
      parts.push("DB");
      parts.push("teamsCount: " + String(dbInfo.teamsCount));
      parts.push("teamLookup: " + String(dbInfo.teamLookup));
      parts.push("playersCountForTeam: " + String(dbInfo.playersCountForTeam));
      parts.push("coachesCountForTeam: " + String(dbInfo.coachesCountForTeam));
      if(dbInfo.firstTeam){
        parts.push("firstTeam: " + dbInfo.firstTeam.name + " / " + (dbInfo.firstTeam.season || ""));
      }
      if(dbInfo.dbError) parts.push("db-fel: " + dbInfo.dbError);
    }catch(err){
      parts.push("DB FEL: " + (err.message || String(err)));
    }

    const msg = parts.join("\n");
    if(box) box.textContent = msg;
    if(debug) debug.textContent = msg;
  }

  async function init(){
    try{
      if(window.Auth?.init) await Auth.init();
      byId("addPlayerBtn")?.addEventListener("click", addPlayer);
      byId("addCoachBtn")?.addEventListener("click", addCoach);
      await loadPlayers();
      await loadCoaches();
    } catch(err){
      const el = byId("appError");
      if(el) el.textContent = err.message || String(err);
    }
    await renderDebug();
  }

  return { init, renderDebug };
})();

window.addEventListener("DOMContentLoaded", () => NSK2App.init());
