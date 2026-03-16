window.DB = (() => {
  const TEAM_NAME = "NSK Team 18";
  const TEAM_SEASON = "2026";

  function normalizeName(name) {
    return String(name || "").trim();
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
  }

  function nullableUuid(value) {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;
    return isUuid(s) ? s : null;
  }

  function uuidArray(values) {
    if (!Array.isArray(values)) return [];
    return values.map(nullableUuid).filter(Boolean);
  }

  async function getClient() {
    if (window.Auth?.init) await window.Auth.init();
    const client = window.Auth?.getClient?.();
    if (!client) throw new Error("Supabase-klient saknas.");
    return client;
  }

  async function findExactTeam(client) {
    const { data, error } = await client
      .from("nsk_teams")
      .select("id, name, season, created_at")
      .eq("name", TEAM_NAME)
      .eq("season", TEAM_SEASON)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) throw error;
    return Array.isArray(data) && data.length ? data[0] : null;
  }

  async function findAnyTeam(client) {
    const { data, error } = await client
      .from("nsk_teams")
      .select("id, name, season, created_at")
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) throw error;
    return Array.isArray(data) && data.length ? data[0] : null;
  }

  async function getTeamId() {
    const client = await getClient();
    const exact = await findExactTeam(client);
    if (exact?.id) return exact.id;

    const anyTeam = await findAnyTeam(client);
    if (anyTeam?.id) return anyTeam.id;

    throw new Error("Inget team finns i databasen. Lägg först in NSK Team 18 i Supabase.");
  }

  async function ensureUniqueByName(table, teamId, fullName) {
    const client = await getClient();
    const { data, error } = await client
      .from(table)
      .select("id, full_name, team_id")
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

    const existing = await ensureUniqueByName("nsk_players", teamId, full_name);
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

    const existing = await ensureUniqueByName("nsk_coaches", teamId, full_name);
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
    return (data || []).map((r) => ({
      ...r,
      goalie_player_id: nullableUuid(r.goalie_player_id),
      players_on_field: uuidArray(r.players_on_field)
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
    return data ? {
      ...data,
      goalie_player_id: nullableUuid(data.goalie_player_id),
      players_on_field: uuidArray(data.players_on_field)
    } : null;
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
      goalie_player_id: nullableUuid(payload.goalie_player_id),
      players_on_field: uuidArray(payload.players_on_field)
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
        goalie_player_id: nullableUuid(data.goalie_player_id),
        players_on_field: uuidArray(data.players_on_field)
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
      goalie_player_id: nullableUuid(data.goalie_player_id),
      players_on_field: uuidArray(data.players_on_field)
    };
  }

  async function getPlayersOnField(poolId, lagNo, matchNo) {
    const players = await listPlayers();
    const row = await getPoolTeamMatchConfig(poolId, lagNo, matchNo);
    const fallback = String(matchNo) !== "1" ? await getPoolTeamMatchConfig(poolId, lagNo, 1) : null;
    const source = row || fallback;
    const ids = uuidArray(source?.players_on_field);
    if (!ids.length) return players;
    return players.filter((p) => ids.includes(String(p.id)));
  }

  async function getLineup(matchConfigId) {
    const client = await getClient();
    const { data, error } = await client
      .from("nsk_lineups")
      .select("id, pool_id, match_config_id, person_type, person_id, sort_order")
      .eq("match_config_id", matchConfigId)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data || []).map((r) => ({
      ...r,
      person_id: nullableUuid(r.person_id)
    })).filter((r) => r.person_id);
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

    uuidArray(playerIds).forEach((p) => {
      rows.push({
        pool_id: poolId,
        match_config_id: matchConfigId,
        person_type: "player",
        person_id: p,
        sort_order: sort++
      });
    });

    uuidArray(coachIds).forEach((c) => {
      rows.push({
        pool_id: poolId,
        match_config_id: matchConfigId,
        person_type: "coach",
        person_id: c,
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
      .filter((r) => String(r.lag_no) !== String(currentLagNo))
      .map((r) => String(r.id));

    if (!otherIds.length) return [];

    const client = await getClient();
    const { data, error } = await client
      .from("nsk_lineups")
      .select("person_id, person_type, match_config_id")
      .in("match_config_id", otherIds)
      .eq("person_type", "player");

    if (error) throw error;
    return (data || []).map((r) => nullableUuid(r.person_id)).filter(Boolean);
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
    return (data || []).map((r) => ({
      ...r,
      players_json: uuidArray(r.players_json)
    }));
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
      players_json: uuidArray(s.players),
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
    savePlayerCoachMap,
    subscribeTruppen
  };
})();