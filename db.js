window.DB = (() => {
  const LOCAL = "nsk_v73";

  function emptyPool() {
    return {
      id: "",
      cloud_id: "",
      name: "",
      players: [],
      goalie: "",
      shiftSeconds: 90,
      matches: []
    };
  }

  function defaults() {
    return {
      pool: emptyPool(),
      pools: []
    };
  }

  function normalizePool(pool) {
    const src = pool || {};
    return {
      id: src.id || "",
      cloud_id: src.cloud_id || "",
      name: src.name || "",
      players: Array.isArray(src.players) ? src.players : [],
      goalie: src.goalie || "",
      shiftSeconds: Number(src.shiftSeconds || 90),
      matches: Array.isArray(src.matches) ? src.matches : []
    };
  }

  function readLocal() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL));
      if (!raw || typeof raw !== "object") return defaults();

      const data = defaults();

      if (raw.pool) data.pool = normalizePool(raw.pool);

      if (Array.isArray(raw.pools)) {
        data.pools = raw.pools.map(normalizePool);
      } else if (raw.pool && raw.pool.cloud_id) {
        data.pools = [normalizePool(raw.pool)];
      }

      return data;
    } catch {
      return defaults();
    }
  }

  function writeLocal(data) {
    localStorage.setItem(LOCAL, JSON.stringify(data));
  }

  function load() {
    return readLocal();
  }

  function save(data) {
    const current = readLocal();
    const next = {
      ...current,
      ...data
    };

    if (data?.pool) {
      next.pool = normalizePool(data.pool);

      const idx = (next.pools || []).findIndex(p =>
        (p.cloud_id && p.cloud_id === next.pool.cloud_id) ||
        (p.id && p.id === next.pool.id)
      );

      if (idx >= 0) {
        next.pools[idx] = normalizePool(next.pool);
      } else if (next.pool.cloud_id || next.pool.id || next.pool.name) {
        next.pools = [...(next.pools || []), normalizePool(next.pool)];
      }
    }

    if (Array.isArray(data?.pools)) {
      next.pools = data.pools.map(normalizePool);
    }

    writeLocal(next);
    return next;
  }

  function listPools() {
    const data = readLocal();
    if (Array.isArray(data.pools) && data.pools.length) return data.pools;
    if (data.pool && (data.pool.cloud_id || data.pool.id || data.pool.name)) {
      return [data.pool];
    }
    return [];
  }

  function getPool(cloud_id) {
    if (!cloud_id) return null;
    return listPools().find(p => p.cloud_id === cloud_id) || null;
  }

  function removePool(cloud_id) {
    if (!cloud_id) return readLocal();

    const data = readLocal();
    const pools = (data.pools || []).filter(p => p.cloud_id !== cloud_id);

    let pool = data.pool;
    if (pool?.cloud_id === cloud_id) {
      pool = emptyPool();
    }

    const next = { ...data, pool, pools };
    writeLocal(next);
    return next;
  }

  async function getClient() {
    if (window.Auth?.init) await window.Auth.init();
    const client = window.Auth?.getClient?.();
    if (!client) throw new Error("Ingen Supabase-klient.");
    return client;
  }

  async function upsertPool(pool) {
    const safePool = normalizePool(pool);
    save({ pool: safePool });

    if (!safePool.cloud_id) return safePool;

    const client = await getClient();
    const row = {
      cloud_id: safePool.cloud_id,
      payload: safePool,
      updated_at: new Date().toISOString()
    };

    const { error } = await client
      .from("pools")
      .upsert(row, { onConflict: "cloud_id" });

    if (error) throw error;
    return safePool;
  }

  async function fetchPool(cloud_id) {
    if (!cloud_id) throw new Error("Pool-id saknas.");

    const local = getPool(cloud_id);
    try {
      const client = await getClient();
      const { data, error } = await client
        .from("pools")
        .select("payload")
        .eq("cloud_id", cloud_id)
        .single();

      if (error) throw error;

      const pool = normalizePool(data?.payload);
      save({ pool });
      return pool;
    } catch (err) {
      if (local) return local;
      throw err;
    }
  }

  function subscribePool(cloud_id, callback) {
    const client = window.Auth?.getClient?.();
    if (!client || !cloud_id) return null;

    return client
      .channel("pools-" + cloud_id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pools",
          filter: "cloud_id=eq." + cloud_id
        },
        payload => {
          const pool = payload?.new?.payload;
          if (!pool) return;
          const safePool = normalizePool(pool);
          save({ pool: safePool });
          if (typeof callback === "function") callback(safePool);
        }
      )
      .subscribe();
  }

  return {
    load,
    save,
    listPools,
    getPool,
    removePool,
    upsertPool,
    fetchPool,
    subscribePool
  };
})();