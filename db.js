window.DB = (() => {
  const KEY = "nsk_v73";

  function uid() {
    return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function defaults() {
    return {
      pool: null,
      pools: [],
      players: [],
      coaches: []
    };
  }

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw || typeof raw !== "object") return defaults();
      return {
        pool: raw.pool && typeof raw.pool === "object" ? raw.pool : null,
        pools: Array.isArray(raw.pools) ? raw.pools : [],
        players: Array.isArray(raw.players) ? raw.players : [],
        coaches: Array.isArray(raw.coaches) ? raw.coaches : []
      };
    } catch {
      return defaults();
    }
  }

  function write(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function normalizePool(pool) {
    const p = pool || {};
    return {
      id: String(p.id || uid()),
      cloud_id: p.cloud_id ? String(p.cloud_id) : "",
      title: String(p.title || "Poolspel"),
      place: String(p.place || ""),
      pool_date: p.pool_date || "",
      status: String(p.status || "Aktiv"),
      teams: Number.parseInt(p.teams ?? 2, 10) || 2,
      matches: Number.parseInt(p.matches ?? 4, 10) || 4,
      players_on_field: Number.parseInt(p.players_on_field ?? 3, 10) || 3,
      periods: Number.parseInt(p.periods ?? 1, 10) || 1,
      period_time: Number.parseInt(p.period_time ?? 15, 10) || 15,
      sub_time: Number.parseInt(p.sub_time ?? 90, 10) || 90
    };
  }

  function normalizePerson(row, fallbackName = "") {
    const r = row || {};
    return {
      id: String(r.id || uid()),
      full_name: String(r.full_name || fallbackName || "").trim()
    };
  }

  function emitTruppen(type) {
    window.dispatchEvent(new CustomEvent("nsk:truppen", { detail: { type } }));
  }

  function load() {
    const data = read();
    return clone(data);
  }

  function save(data) {
    const current = read();
    const next = {
      ...current,
      ...(data || {})
    };

    if (data?.pool) next.pool = normalizePool(data.pool);
    if (Array.isArray(data?.pools)) next.pools = data.pools.map(normalizePool);
    if (Array.isArray(data?.players)) next.players = data.players.map(p => normalizePerson(p));
    if (Array.isArray(data?.coaches)) next.coaches = data.coaches.map(c => normalizePerson(c));

    write(next);
    return clone(next);
  }

  async function listPools() {
    const data = read();
    const pools = data.pools.map(normalizePool);
    if (pools.length) return pools;
    if (data.pool) return [normalizePool(data.pool)];
    return [];
  }

  async function getPool(id) {
    if (!id) return null;
    const pools = await listPools();
    return pools.find(p => String(p.id) === String(id) || String(p.cloud_id) === String(id)) || null;
  }

  async function addPool(payload) {
    const data = read();
    const pool = normalizePool(payload);
    data.pool = pool;
    data.pools = [pool, ...data.pools.filter(p => String(p.id) !== pool.id)];
    write(data);
    return clone(pool);
  }

  async function updatePool(id, payload) {
    const data = read();
    const idx = data.pools.findIndex(p => String(p.id) === String(id) || String(p.cloud_id) === String(id));
    if (idx === -1) throw new Error("Poolspel hittades inte.");
    const updated = normalizePool({ ...data.pools[idx], ...(payload || {}), id: data.pools[idx].id, cloud_id: data.pools[idx].cloud_id || "" });
    data.pools[idx] = updated;
    if (data.pool && (String(data.pool.id) === String(id) || String(data.pool.cloud_id) === String(id))) {
      data.pool = updated;
    }
    write(data);
    return clone(updated);
  }

  async function deletePool(id) {
    const data = read();
    data.pools = data.pools.filter(p => String(p.id) !== String(id) && String(p.cloud_id) !== String(id));
    if (data.pool && (String(data.pool.id) === String(id) || String(data.pool.cloud_id) === String(id))) {
      data.pool = null;
    }
    write(data);
    return true;
  }

  async function listPlayers() {
    return read().players.map(p => normalizePerson(p));
  }

  async function addPlayer(name) {
    const full_name = String(name || "").trim();
    if (!full_name) throw new Error("Spelarnamn saknas.");
    const data = read();
    const found = data.players.find(p => String(p.full_name || "").toLowerCase() === full_name.toLowerCase());
    if (found) return normalizePerson(found);
    const row = normalizePerson({ full_name });
    data.players.push(row);
    write(data);
    emitTruppen("players");
    return clone(row);
  }

  async function updatePlayer(id, name) {
    const full_name = String(name || "").trim();
    if (!full_name) throw new Error("Spelarnamn saknas.");
    const data = read();
    const row = data.players.find(p => String(p.id) === String(id));
    if (!row) throw new Error("Spelare hittades inte.");
    row.full_name = full_name;
    write(data);
    emitTruppen("players");
    return clone(row);
  }

  async function deletePlayer(id) {
    const data = read();
    data.players = data.players.filter(p => String(p.id) !== String(id));
    write(data);
    emitTruppen("players");
    return true;
  }

  async function listCoaches() {
    return read().coaches.map(c => normalizePerson(c));
  }

  async function addCoach(name) {
    const full_name = String(name || "").trim();
    if (!full_name) throw new Error("Tränarnamn saknas.");
    const data = read();
    const found = data.coaches.find(c => String(c.full_name || "").toLowerCase() === full_name.toLowerCase());
    if (found) return normalizePerson(found);
    const row = normalizePerson({ full_name });
    data.coaches.push(row);
    write(data);
    emitTruppen("coaches");
    return clone(row);
  }

  async function updateCoach(id, name) {
    const full_name = String(name || "").trim();
    if (!full_name) throw new Error("Tränarnamn saknas.");
    const data = read();
    const row = data.coaches.find(c => String(c.id) === String(id));
    if (!row) throw new Error("Tränare hittades inte.");
    row.full_name = full_name;
    write(data);
    emitTruppen("coaches");
    return clone(row);
  }

  async function deleteCoach(id) {
    const data = read();
    data.coaches = data.coaches.filter(c => String(c.id) !== String(id));
    write(data);
    emitTruppen("coaches");
    return true;
  }

  async function subscribeTruppen(callback) {
    const handler = (event) => {
      if (typeof callback === "function") callback(event.detail?.type || "");
    };
    window.addEventListener("nsk:truppen", handler);
    return {
      unsubscribe() {
        window.removeEventListener("nsk:truppen", handler);
      }
    };
  }

  // Backward-compatible methods used by older app.js variants
  async function upsertPool(pool) {
    const existing = pool?.id ? await getPool(pool.id) : null;
    return existing ? updatePool(existing.id, pool) : addPool(pool);
  }

  async function fetchPool(id) {
    const pool = await getPool(id);
    if (!pool) throw new Error("Poolspel hittades inte.");
    return pool;
  }

  function subscribePool(_cloudId, _callback) {
    return null;
  }

  const api = {
    load,
    save,
    listPools,
    getPool,
    addPool,
    updatePool,
    deletePool,
    listPlayers,
    addPlayer,
    updatePlayer,
    deletePlayer,
    listCoaches,
    addCoach,
    updateCoach,
    deleteCoach,
    subscribeTruppen,
    upsertPool,
    fetchPool,
    subscribePool
  };

  console.log("DB loaded", Object.keys(api));
  return api;
})();
