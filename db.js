window.DB = (() => {
  const KEY = "nsk_v73";
  const TEAM_NAME = "NSK Team 18";
  const TEAM_SEASON = "2026";

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function defaults() {
    return {
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

  function emitTruppen(type) {
    window.dispatchEvent(new CustomEvent("nsk:truppen-changed", { detail: { type } }));
  }

  async function getClient() {
    if (window.Auth?.init) await window.Auth.init();
    const client = window.Auth?.getClient?.();
    return client || null;
  }

  async function getTeamId() {
    const client = await getClient();
    if (!client) return null;

    let exact = await client
      .from("nsk_teams")
      .select("id,name,season")
      .eq("name", TEAM_NAME)
      .eq("season", TEAM_SEASON)
      .limit(1)
      .maybeSingle();

    if (!exact.error && exact.data?.id) return exact.data.id;

    const inserted = await client
      .from("nsk_teams")
      .insert({ name: TEAM_NAME, season: TEAM_SEASON })
      .select("id")
      .single();

    if (inserted.error) throw inserted.error;
    return inserted.data.id;
  }

  function normalizePool(pool) {
    const p = pool || {};
    return {
      id: p.id || uid(),
      title: p.title || "Poolspel",
      place: p.place || "",
      pool_date: p.pool_date || "",
      status: p.status || "Aktiv",
      teams: Number(p.teams || 2),
      matches: Number(p.matches || 4),
      players_on_field: Number(p.players_on_field || 3),
      periods: Number(p.periods || 1),
      period_time: Number(p.period_time || 15),
      sub_time: Number(p.sub_time || 90)
    };
  }

  async function listPools() {
    return read().pools;
  }

  async function getPool(id) {
    return read().pools.find(p => String(p.id) === String(id)) || null;
  }

  async function addPool(payload) {
    const data = read();
    const pool = normalizePool(payload);
    data.pools.unshift(pool);
    write(data);
    return pool;
  }

  async function updatePool(id, payload) {
    const data = read();
    const idx = data.pools.findIndex(p => String(p.id) === String(id));
    if (idx < 0) throw new Error("Poolspel hittades inte.");

    data.pools[idx] = normalizePool({
      ...data.pools[idx],
      ...payload,
      id: data.pools[idx].id
    });

    write(data);
    return data.pools[idx];
  }

  async function deletePool(id) {
    const data = read();
    data.pools = data.pools.filter(p => String(p.id) !== String(id));
    write(data);
    return true;
  }

  async function listPlayers() {
    const client = await getClient();
    try {
      if (client) {
        const teamId = await getTeamId();
        if (teamId) {
          const { data, error } = await client
            .from("nsk_players")
            .select("id, full_name")
            .eq("team_id", teamId)
            .order("full_name");

          if (!error && Array.isArray(data)) {
            const local = read();
            local.players = data;
            write(local);
            return data;
          }
        }
      }
    } catch {}

    return read().players;
  }

  async function addPlayer(name) {
    const full_name = String(name || "").trim();
    if (!full_name) throw new Error("Spelarnamn saknas.");

    const client = await getClient();

    if (client) {
      const teamId = await getTeamId();
      const { data } = await client
        .from("nsk_players")
        .insert({ team_id: teamId, full_name })
        .select("id, full_name")
        .single();

      emitTruppen("players");
      return data;
    }

    const data = read();
    const row = { id: uid(), full_name };
    data.players.push(row);
    write(data);
    emitTruppen("players");
    return row;
  }

  async function updatePlayer(id, name) {
    const full_name = String(name || "").trim();
    const client = await getClient();

    if (client) {
      await client
        .from("nsk_players")
        .update({ full_name })
        .eq("id", id);
    }

    const data = read();
    const row = data.players.find(p => String(p.id) === String(id));
    if (row) row.full_name = full_name;
    write(data);
    emitTruppen("players");
    return row;
  }

  async function deletePlayer(id) {
    const client = await getClient();
    if (client) {
      await client.from("nsk_players").delete().eq("id", id);
    }

    const data = read();
    data.players = data.players.filter(p => String(p.id) !== String(id));
    write(data);
    emitTruppen("players");
    return true;
  }

  async function listCoaches() {
    const client = await getClient();
    try {
      if (client) {
        const teamId = await getTeamId();
        const { data } = await client
          .from("nsk_coaches")
          .select("id, full_name")
          .eq("team_id", teamId)
          .order("full_name");

        if (data) return data;
      }
    } catch {}

    return read().coaches;
  }

  async function addCoach(name) {
    const full_name = String(name || "").trim();
    const client = await getClient();

    if (client) {
      const teamId = await getTeamId();
      const { data } = await client
        .from("nsk_coaches")
        .insert({ team_id: teamId, full_name })
        .select("id, full_name")
        .single();

      emitTruppen("coaches");
      return data;
    }

    const data = read();
    const row = { id: uid(), full_name };
    data.coaches.push(row);
    write(data);
    emitTruppen("coaches");
    return row;
  }

  async function updateCoach(id, name) {
    const full_name = String(name || "").trim();
    const client = await getClient();

    if (client) {
      await client
        .from("nsk_coaches")
        .update({ full_name })
        .eq("id", id);
    }

    const data = read();
    const row = data.coaches.find(c => String(c.id) === String(id));
    if (row) row.full_name = full_name;
    write(data);
    emitTruppen("coaches");
    return row;
  }

  async function deleteCoach(id) {
    const client = await getClient();

    if (client) {
      await client.from("nsk_coaches").delete().eq("id", id);
    }

    const data = read();
    data.coaches = data.coaches.filter(c => String(c.id) !== String(id));
    write(data);
    emitTruppen("coaches");
    return true;
  }

  async function subscribeTruppen(callback) {
    const handler = (e) => {
      if (typeof callback === "function") callback(e.detail?.type || "");
    };

    window.addEventListener("nsk:truppen-changed", handler);

    return {
      unsubscribe() {
        window.removeEventListener("nsk:truppen-changed", handler);
      }
    };
  }

  return {
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

    subscribeTruppen
  };
})();