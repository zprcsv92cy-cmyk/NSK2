window.DB = (() => {
  const KEY = "nsk_v61_state";

  function defaults() {
    return {
      pools: [],
      invites: [],
      players: [],
      settings: {
        goalie: "",
        shiftSeconds: 90,
        syncEnabled: false,
        syncStatus: "lokal"
      }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : defaults();
      data.pools = Array.isArray(data.pools) ? data.pools : [];
      data.invites = Array.isArray(data.invites) ? data.invites : [];
      data.players = Array.isArray(data.players) ? data.players : [];
      data.settings = { ...defaults().settings, ...(data.settings || {}) };
      return data;
    } catch {
      return defaults();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function savePool(pool) {
    const data = load();
    const idx = data.pools.findIndex(p => p.id === pool.id);
    if (idx >= 0) data.pools[idx] = pool;
    else data.pools.unshift(pool);
    save(data);
    return pool;
  }

  function saveInvite(invite) {
    const data = load();
    const idx = data.invites.findIndex(i => i.email.toLowerCase() === invite.email.toLowerCase());
    if (idx >= 0) data.invites[idx] = invite;
    else data.invites.unshift(invite);
    save(data);
    return invite;
  }

  function savePlayers(players, goalie, shiftSeconds) {
    const data = load();
    data.players = players;
    data.settings.goalie = goalie || "";
    data.settings.shiftSeconds = Number(shiftSeconds) || 90;
    save(data);
  }

  function saveSyncStatus(status) {
    const data = load();
    data.settings.syncStatus = status || "lokal";
    save(data);
  }

  async function syncNow(payload) {
    // Förberett för Supabase-tabell i nästa steg.
    // Just nu markerar vi bara senaste sync lokalt.
    const data = load();
    data.settings.syncStatus = "synkad " + new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    if (payload) data.lastSyncedPayload = payload;
    save(data);
    return { ok: true, mode: "local-stub" };
  }

  return { load, save, savePool, saveInvite, savePlayers, saveSyncStatus, syncNow };
})();
