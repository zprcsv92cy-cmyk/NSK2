// app.js patch — Målvaktsstatistik V2 (räknar bara antal matcher)
(function(){
  if (!window.NSK2App) return;

  function byId(id){ return document.getElementById(id); }
  function esc(s){
    return String(s ?? "").replace(/[&<>"]/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m]));
  }

  async function getClient(){
    if(window.Auth?.init) await Auth.init();
    if(!window.Auth?.getClient) throw new Error("Auth.getClient saknas i auth.js");
    return Auth.getClient();
  }

  async function loadGoalieMatchCounts(){
    const list = byId("goalieStatsList");
    if(!list) return;

    try{
      const client = await getClient();
      const { data, error } = await client
        .from("nsk_goalie_stats")
        .select("goalie_name, match_id");

      if(error) throw error;

      const grouped = {};

      (data || []).forEach(row => {
        const name = (row.goalie_name || "").trim() || "Okänd målvakt";
        if(!grouped[name]) grouped[name] = new Set();
        if(row.match_id) grouped[name].add(row.match_id);
      });

      const rows = Object.entries(grouped)
        .map(([name, matches]) => ({
          name,
          matches: matches.size
        }))
        .sort((a,b) => {
          if (b.matches !== a.matches) return b.matches - a.matches;
          return a.name.localeCompare(b.name, "sv");
        });

      if(!rows.length){
        list.innerHTML = '<div class="listrow">Ingen målvaktsstatistik ännu.</div>';
        return;
      }

      list.innerHTML = rows.map(r => `
        <div class="listrow">
          <strong>${esc(r.name)}</strong> — ${r.matches} ${r.matches === 1 ? "match" : "matcher"}
        </div>
      `).join("");

    }catch(err){
      const errorBox = byId("appError");
      if(errorBox) errorBox.textContent = err.message || String(err);
    }
  }

  const oldInit = window.NSK2App.init;

  window.NSK2App.init = async function(){
    if (oldInit) await oldInit();
    await loadGoalieMatchCounts();
  };
})();
