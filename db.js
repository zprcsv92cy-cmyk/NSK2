window.DB = (() => {
  const TEAM_NAME = "NSK Team 18";
  const TEAM_SEASON = "2026";

  async function getClient() {
    if (window.Auth?.init) await window.Auth.init();
    const client = window.Auth?.getClient?.();
    if (!client) throw new Error("Supabase-klient saknas.");
    return client;
  }

  function normalizeName(name) {
    return String(name || "").trim();
  }

  async function getTeamId() {
    const client = await getClient();

    const exact = await client
      .from("nsk_teams")
      .select("id, name, season, created_at")
      .eq("name", TEAM_NAME)
      .eq("season", TEAM_SEASON)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!exact.error && Array.isArray(exact.data) && exact.data.length) {
      return exact.data[0].id;
    }

    async function getTeamId() {
  const client = await getClient();

  const exact = await client
    .from("nsk_teams")
    .select("id, name, season, created_at")
    .eq("name", "NSK Team 18")
    .eq("season", "2026")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!exact.error && Array.isArray(exact.data) && exact.data.length) {
    return exact.data[0].id;
  }

  const anyTeam = await client
    .from("nsk_teams")
    .select("id, name, season, created_at")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!anyTeam.error && Array.isArray(anyTeam.data) && anyTeam.data.length) {
    return anyTeam.data[0].id;
  }

  throw new Error("Inget team finns i databasen. Lägg först in NSK Team 18 i Supabase.");
}
  async function ensureNoDuplicateByName(table, teamId, fullName) {
    const client = await getClient();
    const { data, error } = await client
      .from(table)
      .select("id, full_name")
      .eq("team_id", teamId)
      .eq("full_name", fullName)
      .limit(1);

    if (error) throw error;
    return Array.isArray(data) && data.length ? data[0] : null;
  }

  async function listPlayers() {
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_players")
      .select("id, full_name, team_id")
      .eq("team_id", teamId)
      .order("full_name", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function addPlayer(name) {
    const full_name = normalizeName(name);
    if (!full_name) throw new Error("Spelarnamn saknas.");

    const client = await getClient();
    const teamId = await getTeamId();

    const existing = await ensureNoDuplicateByName("nsk_players", teamId, full_name);
    if (existing) return existing;

    const { data, error } = await client
      .from("nsk_players")
      .insert({ team_id: teamId, full_name })
      .select("id, full_name, team_id")
      .single();

    if (error) throw error;
    return data;
  }

  async function updatePlayer(id, name) {
    const full_name = normalizeName(name);
    if (!full_name) throw new Error("Spelarnamn saknas.");

    const client = await getClient();
    const { data, error } = await client
      .from("nsk_players")
      .update({ full_name })
      .eq("id", id)
      .select("id, full_name, team_id")
      .single();

    if (error) throw error;
    return data;
  }

  async function deletePlayer(id) {
    const client = await getClient();
    const { error } = await client.from("nsk_players").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function listCoaches() {
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_coaches")
      .select("id, full_name, team_id")
      .eq("team_id", teamId)
      .order("full_name", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function addCoach(name) {
    const full_name = normalizeName(name);
    if (!full_name) throw new Error("Tränarnamn saknas.");

    const client = await getClient();
    const teamId = await getTeamId();

    const existing = await ensureNoDuplicateByName("nsk_coaches", teamId, full_name);
    if (existing) return existing;

    const { data, error } = await client
      .from("nsk_coaches")
      .insert({ team_id: teamId, full_name })
      .select("id, full_name, team_id")
      .single();

    if (error) throw error;
    return data;
  }

  async function updateCoach(id, name) {
    const full_name = normalizeName(name);
    if (!full_name) throw new Error("Tränarnamn saknas.");

    const client = await getClient();
    const { data, error } = await client
      .from("nsk_coaches")
      .update({ full_name })
      .eq("id", id)
      .select("id, full_name, team_id")
      .single();

    if (error) throw error;
    return data;
  }

  async function deleteCoach(id) {
    const client = await getClient();
    const { error } = await client.from("nsk_coaches").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function listPools() {
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_pools")
      .select("id, team_id, title, place, pool_date, status, teams, matches, players_on_field, periods, period_time, sub_time")
      .eq("team_id", teamId)
      .order("pool_date", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function getPool(id) {
    const client = await getClient();
    const { data, error } = await client
      .from("nsk_pools")
      .select("id, team_id, title, place, pool_date, status, teams, matches, players_on_field, periods, period_time, sub_time")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  }

  async function addPool(payload) {
    const client = await getClient();
    const teamId = await getTeamId();

    const row = {
      team_id: teamId,
      title: payload.title || "Poolspel",
      place: payload.place || "",
      pool_date: payload.pool_date || null,
      status: payload.status || "Aktiv",
      teams: Number(payload.teams || 2),
      matches: Number(payload.matches || 4),
      players_on_field: Number(payload.players_on_field || 3),
      periods: Number(payload.periods || 1),
      period_time: Number(payload.period_time || 15),
      sub_time: Number(payload.sub_time || 90)
    };

    const { data, error } = await client
      .from("nsk_pools")
      .insert(row)
      .select("id, team_id, title, place, pool_date, status, teams, matches, players_on_field, periods, period_time, sub_time")
      .single();

    if (error) throw error;
    return data;
  }

  async function updatePool(id, payload) {
    const client = await getClient();

    const row = {
      title: payload.title || "Poolspel",
      place: payload.place || "",
      pool_date: payload.pool_date || null,
      status: payload.status || "Aktiv",
      teams: Number(payload.teams || 2),
      matches: Number(payload.matches || 4),
      players_on_field: Number(payload.players_on_field || 3),
      periods: Number(payload.periods || 1),
      period_time: Number(payload.period_time || 15),
      sub_time: Number(payload.sub_time || 90)
    };

    const { data, error } = await client
      .from("nsk_pools")
      .update(row)
      .eq("id", id)
      .select("id, team_id, title, place, pool_date, status, teams, matches, players_on_field, periods, period_time, sub_time")
      .single();

    if (error) throw error;
    return data;
  }

  async function deletePool(id) {
    const client = await getClient();

    await client.from("nsk_shift_schemas").delete().eq("pool_id", id);
    await client.from("nsk_lineups").delete().eq("pool_id", id);
    await client.from("nsk_pool_team_match_configs").delete().eq("pool_id", id);

    const { error } = await client.from("nsk_pools").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function listPoolTeamMatchConfigs(poolId) {
    const client = await getClient();
    const { data, error } = await client
      .from("nsk_pool_team_match_configs")
      .select("id, pool_id, lag_no, match_no, start_time, opponent, plan, player_count, goalie_player_id, players_on_field")
      .eq("pool_id", poolId)
      .order("lag_no", { ascending: true })
      .order("match_no", { ascending: true });

    if (error) throw error;

    return (data || []).map(r => ({
      ...r,
      players_on_field: Array.isArray(r.players_on_field) ? r.players_on_field.map(String) : []
    }));
  }

  async function getPoolTeamMatchConfig(poolId, lagNo, matchNo) {
    const client = await getClient();
    const { data, error } = await client
      .from("nsk_pool_team_match_configs")
      .select("id, pool_id, lag_no, match_no, start_time, opponent, plan, player_count, goalie_player_id, players_on_field")
      .eq("pool_id", poolId)
      .eq("lag_no", Number(lagNo))
      .eq("match_no", Number(matchNo))
      .maybeSingle();

    if (error) throw error;

    return data
      ? {
          ...data,
          players_on_field: Array.isArray(data.players_on_field) ? data.players_on_field.map(String) : []
        }
      : null;
  }

  async function savePoolTeamMatchConfig(payload) {
    const client = await getClient();

    const safePayload = {
      pool_id: payload.pool_id,
      lag_no: Number(payload.lag_no),
      match_no: Number(payload.match_no),
      start_time: payload.start_time || null,
      opponent: payload.opponent || "",
      plan: payload.plan || "Plan 1",
      player_count: Number(payload.player_count || 0),
      goalie_player_id: payload.goalie_player_id || null,
      players_on_field: Array.isArray(payload.players_on_field) ? payload.players_on_field.map(String) : []
    };

    const existing = await client
      .from("nsk_pool_team_match_configs")
      .select("id")
      .eq("pool_id", safePayload.pool_id)
      .eq("lag_no", safePayload.lag_no)
      .eq("match_no", safePayload.match_no)
      .maybeSingle();

    if (!existing.error && existing.data?.id) {
      const { data, error } = await client
        .from("nsk_pool_team_match_configs")
        .update(safePayload)
        .eq("id", existing.data.id)
        .select("id, pool_id, lag_no, match_no, start_time, opponent, plan, player_count, goalie_player_id, players_on_field")
        .single();

      if (error) throw error;

      return {
        ...data,
        players_on_field: Array.isArray(data.players_on_field) ? data.players_on_field.map(String) : []
      };
    }

    const { data, error } = await client
      .from("nsk_pool_team_match_configs")
      .insert(safePayload)
      .select("id, pool_id, lag_no, match_no, start_time, opponent, plan, player_count, goalie_player_id, players_on_field")
      .single();

    if (error) throw error;

    return {
      ...data,
      players_on_field: Array.isArray(data.players_on_field) ? data.players_on_field.map(String) : []
    };
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

  async function getLineup(matchConfigId) {
    const client = await getClient();
    const { data, error } = await client
      .from("nsk_lineups")
      .select("id, pool_id, match_config_id, person_type, person_id, sort_order")
      .eq("match_config_id", matchConfigId)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function saveLineup(matchConfigId, playerIds, coachIds) {
    const client = await getClient();

    const cfg = await client
      .from("nsk_pool_team_match_configs")
      .select("pool_id")
      .eq("id", matchConfigId)
      .maybeSingle();

    const poolId = cfg.data?.pool_id || null;

    const rows = [];
    let sort = 1;

    (playerIds || []).forEach(p => {
      rows.push({
        pool_id: poolId,
        match_config_id: matchConfigId,
        person_type: "player",
        person_id: String(p),
        sort_order: sort++
      });
    });

    (coachIds || []).forEach(c => {
      rows.push({
        pool_id: poolId,
        match_config_id: matchConfigId,
        person_type: "coach",
        person_id: String(c),
        sort_order: sort++
      });
    });

    const del = await client.from("nsk_lineups").delete().eq("match_config_id", matchConfigId);
    if (del.error) throw del.error;

    if (rows.length) {
      const ins = await client.from("nsk_lineups").insert(rows);
      if (ins.error) throw ins.error;
    }

    return true;
  }

  async function listUsedPlayersInPool(poolId, currentLagNo) {
    const rows = await listPoolTeamMatchConfigs(poolId);
    const otherIds = rows
      .filter(r => String(r.lag_no) !== String(currentLagNo))
      .map(r => String(r.id));

    if (!otherIds.length) return [];

    const client = await getClient();
    const { data, error } = await client
      .from("nsk_lineups")
      .select("person_id, person_type, match_config_id")
      .in("match_config_id", otherIds)
      .eq("person_type", "player");

    if (error) throw error;
    return (data || []).map(r => r.person_id);
  }

  async function listShiftSchema(poolId, lagNo, matchNo) {
    const client = await getClient();
    const { data, error } = await client
      .from("nsk_shift_schemas")
      .select("id, pool_id, lag_no, match_no, shift_no, period_no, time_left, players_json, done")
      .eq("pool_id", poolId)
      .eq("lag_no", Number(lagNo))
      .eq("match_no", Number(matchNo))
      .order("shift_no", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function saveShiftSchema(poolId, lagNo, matchNo, shifts) {
    const client = await getClient();

    const del = await client
      .from("nsk_shift_schemas")
      .delete()
      .eq("pool_id", poolId)
      .eq("lag_no", Number(lagNo))
      .eq("match_no", Number(matchNo));

    if (del.error) throw del.error;

    const rows = (shifts || []).map((s, i) => ({
      pool_id: poolId,
      lag_no: Number(lagNo),
      match_no: Number(matchNo),
      shift_no: i + 1,
      period_no: Number(s.period_no || 1),
      time_left: s.time_left || "00:00",
      players_json: Array.isArray(s.players) ? s.players.map(String) : [],
      done: false
    }));

    if (rows.length) {
      const ins = await client.from("nsk_shift_schemas").insert(rows);
      if (ins.error) throw ins.error;
    }

    return true;
  }

  async function deleteShiftSchema(poolId, lagNo, matchNo) {
    const client = await getClient();
    const { error } = await client
      .from("nsk_shift_schemas")
      .delete()
      .eq("pool_id", poolId)
      .eq("lag_no", Number(lagNo))
      .eq("match_no", Number(matchNo));

    if (error) throw error;
    return true;
  }

  async function setShiftDone(poolId, lagNo, matchNo, shiftNo, done) {
    const client = await getClient();
    const { error } = await client
      .from("nsk_shift_schemas")
      .update({ done: !!done })
      .eq("pool_id", poolId)
      .eq("lag_no", Number(lagNo))
      .eq("match_no", Number(matchNo))
      .eq("shift_no", Number(shiftNo));

    if (error) throw error;
    return true;
  }

  async function listGoalieStats() {
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_goalie_stats")
      .select("id, goalie_name, match_id")
      .eq("team_id", teamId);

    if (error) throw error;
    return data || [];
  }

  async function listPlayerCoachMap() {
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_player_coach_map")
      .select("id, player_name, coach_name")
      .eq("team_id", teamId)
      .order("player_name", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function savePlayerCoachMap(playerName, coachName) {
    const client = await getClient();
    const teamId = await getTeamId();
    const safePlayer = normalizeName(playerName);
    const safeCoach = normalizeName(coachName);

    if (!safePlayer || !safeCoach) {
      throw new Error("Spelare eller tränare saknas.");
    }

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
      return data;
    }

    const { data, error } = await client
      .from("nsk_player_coach_map")
      .insert({ team_id: teamId, player_name: safePlayer, coach_name: safeCoach })
      .select("id, player_name, coach_name")
      .single();

    if (error) throw error;
    return data;
  }

  async function subscribeTruppen(_callback) {
    return {
      unsubscribe() {}
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
    savePlayerCoachMap,
    subscribeTruppen
  };
})();

window.DB = {
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

  savePoolTeamMatchConfig,
  getPoolTeamMatchConfig,
  listPoolTeamMatchConfigs,

  getLineup,
  saveLineup,

  saveShiftSchema,
  listShiftSchema,
  deleteShiftSchema,
  setShiftDone,

  listGoalieStats,

  subscribeTruppen
};