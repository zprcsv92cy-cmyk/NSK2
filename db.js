window.DB = (() => {
  const KEY = "nsk_v73";
  const TEAM_KEY = "nsk_team_id";
  const TEAM_NAME = "NSK Team 18";
  const TEAM_SEASON = "2026";

  function uid() {
    return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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
    localStorage.setItem(KEY, JSON.stringify({ ...defaults(), ...(data || {}) }));
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function emitTruppen(type) {
    window.dispatchEvent(new CustomEvent("nsk:truppen", { detail: { type } }));
  }

  async function getClient() {
    try {
      if (window.Auth?.init) await window.Auth.init();
      return window.Auth?.getClient?.() || null;
    } catch {
      return null;
    }
  }

  async function getTeamId() {
    const cached = localStorage.getItem(TEAM_KEY);
    if (cached) return cached;

    const client = await getClient();
    if (!client) return null;

    const existing = await client
      .from("nsk_teams")
      .select("id")
      .eq("name", TEAM_NAME)
      .eq("season", TEAM_SEASON)
      .maybeSingle();

    if (!existing.error && existing.data?.id) {
      localStorage.setItem(TEAM_KEY, existing.data.id);
      return existing.data.id;
    }

    const created = await client
      .from("nsk_teams")
      .insert({ name: TEAM_NAME, season: TEAM_SEASON })
      .select("id")
      .single();

    if (created.error) throw created.error;
    localStorage.setItem(TEAM_KEY, created.data.id);
    return created.data.id;
  }

  function normalizeName(name) {
    return String(name || "").trim();
  }

  async function listPlayers() {
    const client = await getClient();
    if (client) {
      try {
        const teamId = await getTeamId();
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
      } catch {}
    }
    return read().players;
  }

  async function addPlayer(name) {
    const full_name = normalizeName(name);
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
      local.players.push(data);
      write(local);
      emitTruppen("players");
      return data;
    }

    const local = read();
    const row = { id: uid(), full_name };
    local.players.push(row);
    write(local);
    emitTruppen("players");
    return row;
  }

  async function updatePlayer(id, name) {
    const full_name = normalizeName(name);
    if (!full_name) throw new Error("Spelarnamn saknas.");

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
      write(local);
      emitTruppen("players");
      return data;
    }

    const local = read();
    const row = local.players.find(p => String(p.id) === String(id));
    if (!row) throw new Error("Spelare hittades inte.");
    row.full_name = full_name;
    write(local);
    emitTruppen("players");
    return row;
  }

  async function deletePlayer(id) {
    const client = await getClient();
    if (client) {
      const { error } = await client.from("nsk_players").delete().eq("id", id);
      if (error) throw error;
    }
    const local = read();
    local.players = local.players.filter(p => String(p.id) !== String(id));
    write(local);
    emitTruppen("players");
    return true;
  }

  async function listCoaches() {
    const client = await getClient();
    if (client) {
      try {
        const teamId = await getTeamId();
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
      } catch {}
    }
    return read().coaches;
  }

  async function addCoach(name) {
    const full_name = normalizeName(name);
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
      local.coaches.push(data);
      write(local);
      emitTruppen("coaches");
      return data;
    }

    const local = read();
    const row = { id: uid(), full_name };
    local.coaches.push(row);
    write(local);
    emitTruppen("coaches");
    return row;
  }

  async function updateCoach(id, name) {
    const full_name = normalizeName(name);
    if (!full_name) throw new Error("Tränarnamn saknas.");

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
      write(local);
      emitTruppen("coaches");
      return data;
    }

    const local = read();
    const row = local.coaches.find(c => String(c.id) === String(id));
    if (!row) throw new Error("Tränare hittades inte.");
    row.full_name = full_name;
    write(local);
    emitTruppen("coaches");
    return row;
  }

  async function deleteCoach(id) {
    const client = await getClient();
    if (client) {
      const { error } = await client.from("nsk_coaches").delete().eq("id", id);
      if (error) throw error;
    }
    const local = read();
    local.coaches = local.coaches.filter(c => String(c.id) !== String(id));
    write(local);
    emitTruppen("coaches");
    return true;
  }

  async function listPools() {
    return read().pools;
  }

  async function getPool(id) {
    return read().pools.find(p => String(p.id) === String(id)) || null;
  }

  async function addPool(payload) {
    const local = read();
    const row = { ...payload, id: uid() };
    local.pools.unshift(row);
    write(local);
    return row;
  }

  async function updatePool(id, payload) {
    const local = read();
    const idx = local.pools.findIndex(p => String(p.id) === String(id));
    if (idx < 0) throw new Error("Pool hittades inte");
    local.pools[idx] = { ...local.pools[idx], ...payload };
    write(local);
    return local.pools[idx];
  }

  async function deletePool(id) {
    const local = read();
    local.pools = local.pools.filter(p => String(p.id) !== String(id));
    write(local);
    return true;
  }

  async function getPoolTeamMatchConfig(poolId, lagNo, matchNo) {
    return read().pool_team_match_configs.find(r =>
      String(r.pool_id) === String(poolId) &&
      String(r.lag_no) === String(lagNo) &&
      String(r.match_no) === String(matchNo)
    ) || null;
  }

  async function listPoolTeamMatchConfigs(poolId) {
    return read().pool_team_match_configs.filter(r => String(r.pool_id) === String(poolId));
  }

  async function savePoolTeamMatchConfig(payload) {
    const local = read();
    let row = local.pool_team_match_configs.find(r =>
      String(r.pool_id) === String(payload.pool_id) &&
      String(r.lag_no) === String(payload.lag_no) &&
      String(r.match_no) === String(payload.match_no)
    );
    if (!row) {
      row = { id: uid(), ...payload };
      local.pool_team_match_configs.push(row);
    } else {
      Object.assign(row, payload);
    }
    write(local);
    return row;
  }

  async function getLineup(matchConfigId) {
    return read().lineups
      .filter(l => String(l.match_config_id) === String(matchConfigId))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  async function saveLineup(matchConfigId, playerIds, coachIds) {
    const local = read();
    local.lineups = local.lineups.filter(l => String(l.match_config_id) !== String(matchConfigId));
    let sort = 1;
    playerIds.forEach((p) => {
      local.lineups.push({
        id: uid(),
        match_config_id: matchConfigId,
        person_type: "player",
        person_id: p,
        sort_order: sort++
      });
    });
    coachIds.forEach((c) => {
      local.lineups.push({
        id: uid(),
        match_config_id: matchConfigId,
        person_type: "coach",
        person_id: c,
        sort_order: sort++
      });
    });
    write(local);
    return true;
  }

  async function listUsedPlayersInPool(poolId, currentLagNo) {
    const rows = await listPoolTeamMatchConfigs(poolId);
    const local = read();
    const ids = rows.filter(r => String(r.lag_no) !== String(currentLagNo)).map(r => String(r.id));
    return local.lineups
      .filter(l => l.person_type === "player" && ids.includes(String(l.match_config_id)))
      .map(l => l.person_id);
  }

  async function saveShiftSchema(poolId, lagNo, matchNo, shifts) {
    const local = read();
    local.shift_schemas = local.shift_schemas.filter(s =>
      !(String(s.pool_id) === String(poolId) && String(s.lag_no) === String(lagNo) && String(s.match_no) === String(matchNo))
    );
    shifts.forEach((s, i) => {
      local.shift_schemas.push({
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
    write(local);
  }

  async function listShiftSchema(poolId, lagNo, matchNo) {
    return read().shift_schemas
      .filter(s =>
        String(s.pool_id) === String(poolId) &&
        String(s.lag_no) === String(lagNo) &&
        String(s.match_no) === String(matchNo)
      )
      .sort((a, b) => (a.shift_no || 0) - (b.shift_no || 0));
  }

  async function deleteShiftSchema(poolId, lagNo, matchNo) {
    const local = read();
    local.shift_schemas = local.shift_schemas.filter(s =>
      !(String(s.pool_id) === String(poolId) && String(s.lag_no) === String(lagNo) && String(s.match_no) === String(matchNo))
    );
    write(local);
  }

  async function setShiftDone(poolId, lagNo, matchNo, shiftNo, done) {
    const local = read();
    const row = local.shift_schemas.find(s =>
      String(s.pool_id) === String(poolId) &&
      String(s.lag_no) === String(lagNo) &&
      String(s.match_no) === String(matchNo) &&
      String(s.shift_no) === String(shiftNo)
    );
    if (row) row.done = !!done;
    write(local);
  }

  async function listGoalieStats() {
    const client = await getClient();
    if (client) {
      try {
        const teamId = await getTeamId();
        const { data, error } = await client
          .from("nsk_goalie_stats")
          .select("id, goalie_name, match_id")
          .eq("team_id", teamId);
        if (!error && Array.isArray(data)) {
          const local = read();
          local.goalie_stats = data;
          write(local);
          return data;
        }
      } catch {}
    }
    return read().goalie_stats;
  }

  async function listPlayerCoachMap() {
    const client = await getClient();
    try {
      if (client) {
        const teamId = await getTeamId();
        if (teamId) {
          const { data, error } = await client
            .from("nsk_player_coach_map")
            .select("id, player_name, coach_name")
            .eq("team_id", teamId)
            .order("player_name", { ascending: true });

          if (!error && Array.isArray(data)) {
            const local = read();
            local.player_coach_map = data;
            write(local);
            return data;
          }
        }
      }
    } catch {}

    return read().player_coach_map;
  }

  async function savePlayerCoachMap(playerName, coachName) {
    const safePlayer = normalizeName(playerName);
    const safeCoach = normalizeName(coachName);
    if (!safePlayer || !safeCoach) throw new Error("Spelare eller tränare saknas.");

    const client = await getClient();

    if (client) {
      const teamId = await getTeamId();
      const existing = await client
        .from("nsk_player_coach_map")
        .select("id")
        .eq("team_id", teamId)
        .eq("player_name", safePlayer)
        .maybeSingle();

      if (!existing.error && existing.data?.id) {
        const { data, error } = await client
          .from("nsk_player_coach_map")
          .update({ coach_name: safeCoach })
          .eq("id", existing.data.id)
          .select("id, player_name, coach_name")
          .single();
        if (error) throw error;
        const local = read();
        const idx = local.player_coach_map.findIndex(r => String(r.id) === String(data.id));
        if (idx >= 0) local.player_coach_map[idx] = data;
        else local.player_coach_map.push(data);
        write(local);
        return data;
      }

      const { data, error } = await client
        .from("nsk_player_coach_map")
        .insert({ team_id: teamId, player_name: safePlayer, coach_name: safeCoach })
        .select("id, player_name, coach_name")
        .single();
      if (error) throw error;
        const local = read();
        local.player_coach_map.push(data);
        write(local);
        return data;
    }

    const local = read();
    const existingLocal = local.player_coach_map.find(r => r.player_name === safePlayer);
    if (existingLocal) {
      existingLocal.coach_name = safeCoach;
      write(local);
      return existingLocal;
    }
    const row = { id: uid(), player_name: safePlayer, coach_name: safeCoach };
    local.player_coach_map.push(row);
    write(local);
    return row;
  }

  async function getPlayersOnField(poolId, lagNo, matchNo) {
    const players = await listPlayers();
    const row = await getPoolTeamMatchConfig(poolId, lagNo, matchNo);
    const fallback = String(matchNo) !== "1" ? await getPoolTeamMatchConfig(poolId, lagNo, 1) : null;
    const source = row || fallback;
    const ids = Array.isArray(source?.players_on_field) ? source.players_on_field.map(String) : [];
    if (!ids.length) return players;
    return players.filter(p => ids.includes(String(p.id)));
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
    getLineup,
    saveLineup,
    listUsedPlayersInPool,
    saveShiftSchema,
    listShiftSchema,
    deleteShiftSchema,
    setShiftDone,
    listGoalieStats,
    listPlayerCoachMap,
    savePlayerCoachMap,
    getPlayersOnField,
    subscribeTruppen
  };
})();
