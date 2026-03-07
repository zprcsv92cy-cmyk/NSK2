window.DB = (() => {
  const LOCAL_KEY = "nsk_v62_state";
  const CLOUD_KEY = "team18-main";

  function defaults() {
    return {
      pools: [],
      players: [],
      settings: { goalie: "", shiftSeconds: 90, syncStatus: "lokal" }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const data = raw ? JSON.parse(raw) : defaults();
      data.pools = Array.isArray(data.pools) ? data.pools : [];
      data.players = Array.isArray(data.players) ? data.players : [];
      data.settings = { ...defaults().settings, ...(data.settings || {}) };
      return data;
    } catch {
      return defaults();
    }
  }

  function save(data) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  }

  function savePool(pool) {
    const data = load();
    const idx = data.pools.findIndex(p => p.id === pool.id);
    if (idx >= 0) data.pools[idx] = pool;
    else data.pools.unshift(pool);
    save(data);
    return pool;
  }

  function savePlayers(players, goalie, shiftSeconds) {
    const data = load();
    data.players = players;
    data.settings.goalie = goalie || "";
    data.settings.shiftSeconds = Number(shiftSeconds) || 90;
    save(data);
  }

  function setSyncStatus(status) {
    const data = load();
    data.settings.syncStatus = status || "lokal";
    save(data);
  }

  async function syncNow(payload) {
    const client = window.Auth && Auth.getClient ? Auth.getClient() : null;
    const session = window.Auth && Auth.getSession ? Auth.getSession() : null;
    if (!client || !session) throw new Error("Inte inloggad.");

    const row = {
      id: CLOUD_KEY,
      owner_email: session.user?.email || "",
      payload,
      updated_at: new Date().toISOString()
    };

    const { error } = await client.from("app_state").upsert(row, { onConflict: "id" });
    if (error) throw error;

    setSyncStatus("synkad");
    return { ok: true };
  }

  async function pullNow() {
    const client = window.Auth && Auth.getClient ? Auth.getClient() : null;
    if (!client) throw new Error("Auth saknas.");

    const { data, error } = await client
      .from("app_state")
      .select("payload, updated_at")
      .eq("id", CLOUD_KEY)
      .single();

    if (error) throw error;
    if (!data || !data.payload) throw new Error("Ingen molndata hittades.");

    save(data.payload);
    setSyncStatus("hämtad");
    return data.payload;
  }

  return { load, save, savePool, savePlayers, setSyncStatus, syncNow, pullNow, CLOUD_KEY };
})();
