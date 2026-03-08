/* NSK V9A - truppen med backup/import från Supabase */
(function(){
  if (!window.NSK2App) return;

  const oldInit = window.NSK2App.init;

  async function exportSupabaseBackup() {
    const msg = document.getElementById("backupMsg");
    try {
      const teamId = await DB.getTeamId();
      const players = await DB.listPlayers();
      const coaches = await DB.listCoaches();
      const pools = await DB.listPools();

      const matchesByPool = {};
      const goalieStatsByMatch = {};
      const lineupsByMatch = {};

      for (const pool of pools) {
        const matches = await DB.listMatchesByPool(pool.id);
        matchesByPool[pool.id] = matches;
        for (const match of matches) {
          goalieStatsByMatch[match.id] = await DB.listGoalieStats(match.id);
          lineupsByMatch[match.id] = await DB.listLineups(match.id);
        }
      }

      const payload = {
        exportedAt: new Date().toISOString(),
        teamId,
        players,
        coaches,
        pools,
        matchesByPool,
        goalieStatsByMatch,
        lineupsByMatch
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nsk-team18-backup.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (msg) msg.textContent = "Backup exporterad.";
    } catch (err) {
      console.error(err);
      if (msg) msg.textContent = err.message || "Kunde inte exportera backup.";
    }
  }

  async function importSupabaseBackup(file) {
    const msg = document.getElementById("backupMsg");
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || !Array.isArray(data.players) || !Array.isArray(data.coaches)) {
        throw new Error("Ogiltig backupfil.");
      }

      const currentPlayers = await DB.listPlayers();
      const currentCoaches = await DB.listCoaches();
      const currentPools = await DB.listPools();

      for (const row of currentPlayers) await DB.deletePlayer(row.id);
      for (const row of currentCoaches) await DB.deleteCoach(row.id);
      for (const row of currentPools) await DB.deletePool(row.id);

      for (const row of data.players) {
        await DB.addPlayer(row.full_name || row.name || "");
      }

      for (const row of data.coaches) {
        await DB.addCoach(row.full_name || row.name || "", row.role || "Tränare");
      }

      if (Array.isArray(data.pools)) {
        for (const pool of data.pools) {
          await DB.addPool({
            title: pool.title || pool.name || "Poolspel",
            place: pool.place || "",
            pool_date: pool.pool_date || pool.date || null,
            status: pool.status || "Aktiv"
          });
        }
      }

      if (msg) msg.textContent = "Backup importerad.";
      if (window.NSK2App?.init) {
        // soft refresh
        setTimeout(() => location.reload(), 400);
      }
    } catch (err) {
      console.error(err);
      if (msg) msg.textContent = err.message || "Kunde inte importera backup.";
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    const exportBtn = document.getElementById("exportBtn");
    const importFile = document.getElementById("importFile");

    if (exportBtn) exportBtn.addEventListener("click", exportSupabaseBackup);
    if (importFile) {
      importFile.addEventListener("change", e => {
        const file = e.target.files && e.target.files[0];
        if (file) importSupabaseBackup(file);
      });
    }
  });
})();
