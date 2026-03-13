window.DB = (() => {
  const KEY = "nsk_app_data";
  const TEAM_NAME = "NSK Team 18";
  const TEAM_SEASON = "2026";

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function defaults() {
    return {
      pools: [],
      players: [],
      coaches: [],
      pool_team_match_configs: [],
      lineups: [],
      shift_schemas: [],
      goalie_stats: [],
      player_coach_map: []
    };
  }

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw || typeof raw !== "object") return defaults();
      return { ...defaults(), ...raw };
    } catch {
      return defaults();
    }
  }

  function write(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  async function getClient() {
    if (window.Auth?.init) await window.Auth.init();
    return window.Auth?.getClient?.() || null;
  }

  async function getTeamId() {
    const client = await getClient();
    if (!client) return null;

    const exact = await client
      .from("nsk_teams")
      .select("id,name,season")
      .eq("name", TEAM_NAME)
      .eq("season", TEAM_SEASON)
      .limit(1)
      .maybeSingle();

    if (!exact.error && exact.data?.id) return exact.data.id;

    const byName = await client
      .from("nsk_teams")
      .select("id,name,season")
      .eq("name", TEAM_NAME)
      .limit(1)
      .maybeSingle();

    if (!byName.error && byName.data?.id) return byName.data.id;

    const anyTeam = await client
      .from("nsk_teams")
      .select("id,name,season")
      .limit(1)
      .maybeSingle();

    if (!anyTeam.error && anyTeam.data?.id) return anyTeam.data.id;

    const inserted = await client
      .from("nsk_teams")
      .insert({ name: TEAM_NAME, season: TEAM_SEASON })
      .select("id")
      .single();

    if (inserted.error) throw inserted.error;
    return inserted.data.id;
  }

  // ---------- POOLS ----------

  async function listPools() {
    return read().pools;
  }

  async function getPool(id) {
    return read().pools.find(p => String(p.id) === String(id)) || null;
  }

  async function addPool(payload) {
    const data = read();
    const pool = { ...payload, id: uid() };
    data.pools.unshift(pool);
    write(data);
    return pool;
  }

  async function updatePool(id, payload) {
    const data = read();
    const i = data.pools.findIndex(p => String(p.id) === String(id));
    if (i < 0) throw new Error("Pool hittades inte");
    data.pools[i] = { ...data.pools[i], ...payload };
    write(data);
    return data.pools[i];
  }

  async function deletePool(id) {
    const data = read();
    data.pools = data.pools.filter(p => String(p.id) !== String(id));
    write(data);
    return true;
  }

  // ---------- PLAYERS ----------

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
            .order("full_name", { ascending: true });

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
      const { data, error } = await client
        .from("nsk_players")
        .insert({ team_id: teamId, full_name })
        .select("id, full_name")
        .single();

      if (error) throw error;

      const local = read();
      local.players = [...local.players.filter(p => String(p.id) !== String(data.id)), data];
      write(local);
      return data;
    }

    const data = read();
    const row = { id: uid(), full_name };
    data.players.push(row);
    write(data);
    return row;
  }

  async function updatePlayer(id, name) {
    const full_name = String(name || "").trim();
    const client = await getClient();

    if (client) {
      const { data, error } = await client
        .from("nsk_players")
        .update({ full_name })
        .eq("id", id)
        .select("id, full_name")
        .single();

      if (error) throw error;

      const local = read();
      const idx = local.players.findIndex(p => String(p.id) === String(id));
      if (idx >= 0) local.players[idx] = data;
      else local.players.push(data);
      write(local);
      return data;
    }

    const data = read();
    const row = data.players.find(p => String(p.id) === String(id));
    if (row) row.full_name = full_name;
    write(data);
    return row;
  }

  async function deletePlayer(id) {
    const client = await getClient();

    if (client) {
      const { error } = await client.from("nsk_players").delete().eq("id", id);
      if (error) throw error;
    }

    const data = read();
    data.players = data.players.filter(p => String(p.id) !== String(id));
    write(data);
    return true;
  }

  // ---------- COACHES ----------

  async function listCoaches() {
    const client = await getClient();

    try {
      if (client) {
        const teamId = await getTeamId();
        if (teamId) {
          const { data, error } = await client
            .from("nsk_coaches")
            .select("id, full_name")
            .eq("team_id", teamId)
            .order("full_name", { ascending: true });

          if (!error && Array.isArray(data)) {
            const local = read();
            local.coaches = data;
            write(local);
            return data;
          }
        }
      }
    } catch {}

    return read().coaches;
  }

  async function addCoach(name) {
    const full_name = String(name || "").trim();
    if (!full_name) throw new Error("Tränarnamn saknas.");

    const client = await getClient();

    if (client) {
      const teamId = await getTeamId();
      const { data, error } = await client
        .from("nsk_coaches")
        .insert({ team_id: teamId, full_name })
        .select("id, full_name")
        .single();

      if (error) throw error;

      const local = read();
      local.coaches = [...local.coaches.filter(c => String(c.id) !== String(data.id)), data];
      write(local);
      return data;
    }

    const data = read();
    const row = { id: uid(), full_name };
    data.coaches.push(row);
    write(data);
    return row;
  }

  async function updateCoach(id, name) {
    const full_name = String(name || "").trim();
    const client = await getClient();

    if (client) {
      const { data, error } = await client
        .from("nsk_coaches")
        .update({ full_name })
        .eq("id", id)
        .select("id, full_name")
        .single();

      if (error) throw error;

      const local = read();
      const idx = local.coaches.findIndex(c => String(c.id) === String(id));
      if (idx >= 0) local.coaches[idx] = data;
      else local.coaches.push(data);
      write(local);
      return data;
    }

    const data = read();
    const row = data.coaches.find(c => String(c.id) === String(id));
    if (row) row.full_name = full_name;
    write(data);
    return row;
  }

  async function deleteCoach(id) {
    const client = await getClient();

    if (client) {
      const { error } = await client.from("nsk_coaches").delete().eq("id", id);
      if (error) throw error;
    }

    const data = read();
    data.coaches = data.coaches.filter(c => String(c.id) !== String(id));
    write(data);
    return true;
  }

  // ---------- MATCH CONFIG / FÖRUTSÄTTNINGAR ----------

  async function getPoolTeamMatchConfig(poolId, lagNo, matchNo) {
    const data = read();
    return data.pool_team_match_configs.find(r =>
      String(r.pool_id) === String(poolId) &&
      String(r.lag_no) === String(lagNo) &&
      String(r.match_no) === String(matchNo)
    ) || null;
  }

  async function listPoolTeamMatchConfigs(poolId) {
    const data = read();
    return data.pool_team_match_configs.filter(r => String(r.pool_id) === String(poolId));
  }

  async function savePoolTeamMatchConfig(payload) {
    const data = read();

    const safePayload = {
      ...payload,
      players_on_field: Array.isArray(payload.players_on_field)
        ? payload.players_on_field.map(String)
        : []
    };

    let row = data.pool_team_match_configs.find(r =>
      String(r.pool_id) === String(safePayload.pool_id) &&
      String(r.lag_no) === String(safePayload.lag_no) &&
      String(r.match_no) === String(safePayload.match_no)
    );

    if (!row) {
      row = { id: uid(), ...safePayload };
      data.pool_team_match_configs.push(row);
    } else {
      Object.assign(row, safePayload);
    }

    write(data);
    return row;
  }

  async function getPlayersOnField(poolId, lagNo, matchNo) {
    const config = await getPoolTeamMatchConfig(poolId, lagNo, matchNo);
    if (!config) return [];

    const ids = Array.isArray(config.players_on_field)
      ? config.players_on_field.map(String)
      : [];

    if (!ids.length) return [];

    const players = await listPlayers();
    return players.filter(p => ids.includes(String(p.id)));
  }

  // ---------- LINEUP ----------

  async function getLineup(matchConfigId) {
    const data = read();
    return data.lineups
      .filter(l => String(l.match_config_id) === String(matchConfigId))
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  async function saveLineup(matchConfigId, playerIds, coachIds) {
    const data = read();

    data.lineups = data.lineups.filter(l => String(l.match_config_id) !== String(matchConfigId));

    let sort = 1;

    (playerIds || []).forEach(p => {
      data.lineups.push({
        id: uid(),
        match_config_id: matchConfigId,
        person_type: "player",
        person_id: p,
        sort_order: sort++
      });
    });

    (coachIds || []).forEach(c => {
      data.lineups.push({
        id: uid(),
        match_config_id: matchConfigId,
        person_type: "coach",
        person_id: c,
        sort_order: sort++
      });
    });

    write(data);
    return true;
  }

  async function listUsedPlayersInPool(poolId, currentLagNo) {
    const rows = await listPoolTeamMatchConfigs(poolId);
    const data = read();

    const ids = rows
      .filter(r => String(r.lag_no) !== String(currentLagNo))
      .map(r => String(r.id));

    return data.lineups
      .filter(l => l.person_type === "player" && ids.includes(String(l.match_config_id)))
      .map(l => l.person_id);
  }

  // ---------- SHIFT SCHEMA ----------

  async function saveShiftSchema(poolId, lagNo, matchNo, shifts) {
    const data = read();

    data.shift_schemas = data.shift_schemas.filter(s =>
      !(
        String(s.pool_id) === String(poolId) &&
        String(s.lag_no) === String(lagNo) &&
        String(s.match_no) === String(matchNo)
      )
    );

    (shifts || []).forEach((s, i) => {
      data.shift_schemas.push({
        id: uid(),
        pool_id: poolId,
        lag_no: lagNo,
        match_no: matchNo,
        shift_no: i + 1,
        period_no: s.period_no,
        time_left: s.time_left,
        players_json: s.players,
        done: false
      });
    });

    write(data);
    return true;
  }

  async function listShiftSchema(poolId, lagNo, matchNo) {
    const data = read();
    return data.shift_schemas
      .filter(s =>
        String(s.pool_id) === String(poolId) &&
        String(s.lag_no) === String(lagNo) &&
        String(s.match_no) === String(matchNo)
      )
      .sort((a, b) => a.shift_no - b.shift_no);
  }

  async function deleteShiftSchema(poolId, lagNo, matchNo) {
    const data = read();
    data.shift_schemas = data.shift_schemas.filter(s =>
      !(
        String(s.pool_id) === String(poolId) &&
        String(s.lag_no) === String(lagNo) &&
        String(s.match_no) === String(matchNo)
      )
    );
    write(data);
    return true;
  }

  async function setShiftDone(poolId, lagNo, matchNo, shiftNo, done) {
    const data = read();
    const row = data.shift_schemas.find(s =>
      String(s.pool_id) === String(poolId) &&
      String(s.lag_no) === String(lagNo) &&
      String(s.match_no) === String(matchNo) &&
      String(s.shift_no) === String(shiftNo)
    );
    if (row) row.done = done;
    write(data);
    return true;
  }

  // ---------- ÖVRIGT ----------

  async function listGoalieStats() {
    return read().goalie_stats;
  }

  async function listPlayerCoachMap() {
    return read().player_coach_map;
  }

  async function subscribeTruppen() {
    return { unsubscribe() {} };
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
    getPoolTeamMatchConfig,
    listPoolTeamMatchConfigs,
    savePoolTeamMatchConfig,
    getPlayersOnField,
    getLineup,
    saveLineup,
    listUsedPlayersInPool,
    saveShiftSchema,
    listShiftSchema,
    deleteShiftSchema,
    setShiftDone,
    listGoalieStats,
    listPlayerCoachMap,
    subscribeTruppen
  };
})();