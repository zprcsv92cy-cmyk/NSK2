window.DB = (() => {
  const TEAM_NAME = "NSK Team 18";
  const TEAM_SEASON = "2026";

  async function getClient() {
    if (window.Auth?.init) await Auth.init();
    if (!window.Auth?.getClient) throw new Error("Auth.getClient saknas i auth.js");
    return Auth.getClient();
  }

  async function getTeamId() {
    const client = await getClient();

    let exact = await client
      .from("nsk_teams")
      .select("id,name,season")
      .eq("name", TEAM_NAME)
      .eq("season", TEAM_SEASON)
      .limit(1)
      .maybeSingle();

    if (exact.error) throw exact.error;
    if (exact.data?.id) return exact.data.id;

    let byName = await client
      .from("nsk_teams")
      .select("id,name,season")
      .eq("name", TEAM_NAME)
      .limit(1)
      .maybeSingle();

    if (byName.error) throw byName.error;
    if (byName.data?.id) return byName.data.id;

    let anyTeam = await client
      .from("nsk_teams")
      .select("id,name,season")
      .limit(1)
      .maybeSingle();

    if (anyTeam.error) throw anyTeam.error;
    if (anyTeam.data?.id) return anyTeam.data.id;

    const inserted = await client
      .from("nsk_teams")
      .insert({ name: TEAM_NAME, season: TEAM_SEASON })
      .select("id")
      .single();

    if (inserted.error) throw inserted.error;
    return inserted.data.id;
  }

  async function listPlayers() {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_players")
      .select("*")
      .eq("team_id", teamId)
      .order("full_name", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function addPlayer(name) {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_players")
      .insert({ team_id: teamId, full_name: String(name || "").trim() })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function updatePlayer(id, name) {
    const client = await getClient();
    const { error } = await client
      .from("nsk_players")
      .update({ full_name: String(name || "").trim() })
      .eq("id", id);
    if (error) throw error;
    return true;
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
      .select("*")
      .eq("team_id", teamId)
      .order("full_name", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function addCoach(name) {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_coaches")
      .insert({ team_id: teamId, full_name: String(name || "").trim(), role: "Tränare" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function updateCoach(id, name) {
    const client = await getClient();
    const { error } = await client
      .from("nsk_coaches")
      .update({ full_name: String(name || "").trim() })
      .eq("id", id);
    if (error) throw error;
    return true;
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
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function addPool(payload) {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_pools")
      .insert({
        team_id: teamId,
        title: payload.title || "Poolspel",
        place: payload.place || "",
        pool_date: payload.pool_date || null,
        status: payload.status || "Aktiv",
        teams: payload.teams ?? 2,
        matches: payload.matches ?? 4,
        players_on_field: payload.players_on_field ?? 3,
        periods: payload.periods ?? 1,
        period_time: payload.period_time ?? 15,
        sub_time: payload.sub_time ?? 90
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function updatePool(id, payload) {
    const client = await getClient();
    const { data, error } = await client
      .from("nsk_pools")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function getPool(id) {
    const client = await getClient();
    const { data, error } = await client.from("nsk_pools").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  }

  async function deletePool(id) {
    const client = await getClient();
    const { error } = await client.from("nsk_pools").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function listPoolTeamMatchConfigs(poolId) {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_pool_team_matches")
      .select("*")
      .eq("team_id", teamId)
      .eq("pool_id", poolId)
      .order("lag_no", { ascending: true })
      .order("match_no", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function getPoolTeamMatchConfig(poolId, lagNo, matchNo) {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_pool_team_matches")
      .select("*")
      .eq("team_id", teamId)
      .eq("pool_id", poolId)
      .eq("lag_no", parseInt(lagNo, 10))
      .eq("match_no", parseInt(matchNo, 10))
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function savePoolTeamMatchConfig(payload) {
    const client = await getClient();
    const teamId = await getTeamId();

    const row = {
      team_id: teamId,
      pool_id: payload.pool_id,
      lag_no: payload.lag_no,
      match_no: payload.match_no,
      start_time: payload.start_time || null,
      opponent: payload.opponent || "",
      plan: payload.plan || "Plan 1",
      player_count: payload.player_count ?? null,
      goalie_player_id: payload.goalie_player_id || null
    };

    const { data, error } = await client
      .from("nsk_pool_team_matches")
      .upsert(row, { onConflict: "team_id,pool_id,lag_no,match_no" })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function getLineup(matchId) {
    const client = await getClient();
    const { data, error } = await client
      .from("nsk_pool_team_match_people")
      .select("*")
      .eq("match_id", matchId)
      .order("person_type", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function saveLineup(matchId, players, coaches) {
    const client = await getClient();

    const del = await client
      .from("nsk_pool_team_match_people")
      .delete()
      .eq("match_id", matchId);
    if (del.error) throw del.error;

    const rows = [];
    (players || []).forEach((playerId, i) => {
      if (!playerId) return;
      rows.push({
        match_id: matchId,
        person_id: playerId,
        person_type: "player",
        sort_order: i + 1
      });
    });

    (coaches || []).forEach((coachId, i) => {
      if (!coachId) return;
      rows.push({
        match_id: matchId,
        person_id: coachId,
        person_type: "coach",
        sort_order: i + 1
      });
    });

    if (!rows.length) return true;
    const ins = await client.from("nsk_pool_team_match_people").insert(rows);
    if (ins.error) throw ins.error;
    return true;
  }

  async function listUsedPlayersInPool(poolId, excludeLagNo) {
    const client = await getClient();
    const teamId = await getTeamId();

    const { data: matches, error: matchesError } = await client
      .from("nsk_pool_team_matches")
      .select("id,lag_no")
      .eq("team_id", teamId)
      .eq("pool_id", poolId);

    if (matchesError) throw matchesError;

    const filteredMatches = (matches || []).filter(
      m => String(m.lag_no) !== String(excludeLagNo)
    );

    const matchIds = filteredMatches.map(m => m.id);
    if (!matchIds.length) return [];

    const { data: people, error: peopleError } = await client
      .from("nsk_pool_team_match_people")
      .select("match_id,person_id,person_type")
      .in("match_id", matchIds)
      .eq("person_type", "player");

    if (peopleError) throw peopleError;

    const used = new Set();
    (people || []).forEach(p => {
      if (p.person_id) used.add(String(p.person_id));
    });

    return Array.from(used);
  }

  async function deleteShiftSchema(poolId, lagNo, matchNo) {
    const client = await getClient();
    const teamId = await getTeamId();

    const { error } = await client
      .from("nsk_pool_team_shifts")
      .delete()
      .eq("team_id", teamId)
      .eq("pool_id", poolId)
      .eq("lag_no", parseInt(lagNo, 10))
      .eq("match_no", parseInt(matchNo, 10));

    if (error) throw error;
    return true;
  }

  async function saveShiftSchema(poolId, lagNo, matchNo, shifts) {
    const client = await getClient();
    const teamId = await getTeamId();

    await deleteShiftSchema(poolId, lagNo, matchNo);
    if (!shifts.length) return true;

    const rows = shifts.map((s, i) => ({
      team_id: teamId,
      pool_id: poolId,
      lag_no: parseInt(lagNo, 10),
      match_no: parseInt(matchNo, 10),
      shift_no: i + 1,
      period_no: s.period_no,
      time_left: s.time_left,
      players_json: s.players,
      done: !!s.done
    }));

    const { error } = await client.from("nsk_pool_team_shifts").insert(rows);
    if (error) throw error;
    return true;
  }

  async function listShiftSchema(poolId, lagNo, matchNo) {
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_pool_team_shifts")
      .select("*")
      .eq("team_id", teamId)
      .eq("pool_id", poolId)
      .eq("lag_no", parseInt(lagNo, 10))
      .eq("match_no", parseInt(matchNo, 10))
      .order("shift_no", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function toggleShiftDone(shiftId, done) {
    const client = await getClient();
    const { error } = await client
      .from("nsk_pool_team_shifts")
      .update({ done: !!done })
      .eq("id", shiftId);
    if (error) throw error;
    return true;
  }

  async function listGoalieStats() {
    const client = await getClient();
    const { data, error } = await client
      .from("nsk_goalie_stats")
      .select("goalie_name,match_id");
    if (error) throw error;
    return data || [];
  }

  async function subscribeTruppen(callback) {
    const client = await getClient();
    return client
      .channel("truppen")
      .on("postgres_changes", { event: "*", schema: "public", table: "nsk_players" }, () => callback("players"))
      .on("postgres_changes", { event: "*", schema: "public", table: "nsk_coaches" }, () => callback("coaches"))
      .subscribe();
  }

  return {
    getTeamId,
    listPlayers,
    addPlayer,
    updatePlayer,
    deletePlayer,
    listCoaches,
    addCoach,
    updateCoach,
    deleteCoach,
    listPools,
    addPool,
    updatePool,
    getPool,
    deletePool,
    listPoolTeamMatchConfigs,
    getPoolTeamMatchConfig,
    savePoolTeamMatchConfig,
    getLineup,
    saveLineup,
    listUsedPlayersInPool,
    deleteShiftSchema,
    saveShiftSchema,
    listShiftSchema,
    toggleShiftDone,
    listGoalieStats,
    subscribeTruppen
  };
})();
