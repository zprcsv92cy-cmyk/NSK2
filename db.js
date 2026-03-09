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
      .select("id, full_name, sort_order")
      .eq("team_id", teamId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("full_name", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function addPlayer(name) {
    const client = await getClient();
    const teamId = await getTeamId();

    const { data:maxData } = await client
      .from("nsk_players")
      .select("sort_order")
      .eq("team_id", teamId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSort = ((maxData && maxData[0] && maxData[0].sort_order) || 0) + 1;

    const { data, error } = await client
      .from("nsk_players")
      .insert({ team_id: teamId, full_name: String(name || "").trim(), sort_order: nextSort })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function updatePlayer(id, fullName) {
    const client = await getClient();
    const { data, error } = await client
      .from("nsk_players")
      .update({ full_name: String(fullName || "").trim() })
      .eq("id", id)
      .select("*")
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

  async function savePlayerOrder(ids) {
    const client = await getClient();
    for (let i = 0; i < ids.length; i++) {
      const { error } = await client
        .from("nsk_players")
        .update({ sort_order: i + 1 })
        .eq("id", ids[i]);
      if (error) throw error;
    }
    return true;
  }

  async function listCoaches() {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_coaches")
      .select("id, full_name, sort_order, role")
      .eq("team_id", teamId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("full_name", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function addCoach(name) {
    const client = await getClient();
    const teamId = await getTeamId();

    const { data:maxData } = await client
      .from("nsk_coaches")
      .select("sort_order")
      .eq("team_id", teamId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSort = ((maxData && maxData[0] && maxData[0].sort_order) || 0) + 1;

    const { data, error } = await client
      .from("nsk_coaches")
      .insert({ team_id: teamId, full_name: String(name || "").trim(), role: "Tränare", sort_order: nextSort })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function updateCoach(id, fullName) {
    const client = await getClient();
    const { data, error } = await client
      .from("nsk_coaches")
      .update({ full_name: String(fullName || "").trim() })
      .eq("id", id)
      .select("*")
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

  async function saveCoachOrder(ids) {
    const client = await getClient();
    for (let i = 0; i < ids.length; i++) {
      const { error } = await client
        .from("nsk_coaches")
        .update({ sort_order: i + 1 })
        .eq("id", ids[i]);
      if (error) throw error;
    }
    return true;
  }

  async function listPools() {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_pools")
      .select("*")
      .eq("team_id", teamId)
      .order("pool_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function addPool(payload) {
    const client = await getClient();
    const teamId = await getTeamId();
    const row = {
      team_id: teamId,
      title: payload.title || payload.pool_name || "Poolspel",
      place: payload.place || null,
      pool_date: payload.pool_date || null,
      status: payload.status || "Aktiv"
    };
    const { data, error } = await client
      .from("nsk_pools")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function getCurrentPoolId() {
    const saved = sessionStorage.getItem("nsk2_current_pool_id");
    if (saved) return saved;
    const pools = await listPools();
    if (pools.length) return pools[0].id;
    throw new Error("Inget aktivt poolspel valt.");
  }

  async function upsertMatchConfig(payload) {
    const client = await getClient();
    const pool_id = payload.pool_id || await getCurrentPoolId();
    const row = {
      pool_id,
      team_no: Number(payload.team_no || 1),
      match_no: Number(payload.match_no || 1),
      matches_total: Number(payload.matches_total || 1),
      start_time: payload.start_time || null,
      opponent: payload.opponent || null,
      field: payload.field || null,
      players_total: payload.players_total === "" || payload.players_total == null ? null : Number(payload.players_total),
      players_on_field: payload.players_on_field === "" || payload.players_on_field == null ? null : Number(payload.players_on_field),
      periods: payload.periods === "" || payload.periods == null ? null : Number(payload.periods),
      period_minutes: payload.period_minutes === "" || payload.period_minutes == null ? null : Number(payload.period_minutes),
      shift_seconds: payload.shift_seconds === "" || payload.shift_seconds == null ? null : Number(payload.shift_seconds),
      goalie_name: payload.goalie_name || null,
      player_1: payload.player_1 || null,
      player_2: payload.player_2 || null,
      player_3: payload.player_3 || null,
      player_4: payload.player_4 || null,
      player_5: payload.player_5 || null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await client
      .from("nsk_match_configs")
      .upsert(row, { onConflict: "pool_id,team_no,match_no" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function getMatchConfig(teamNo, matchNo, poolId) {
    const client = await getClient();
    const pool_id = poolId || await getCurrentPoolId();
    const { data, error } = await client
      .from("nsk_match_configs")
      .select("*")
      .eq("pool_id", pool_id)
      .eq("team_no", Number(teamNo))
      .eq("match_no", Number(matchNo))
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function listGoalieStats() {
    const client = await getClient();
    const { data, error } = await client
      .from("nsk_goalie_stats")
      .select("goalie_name, match_id");
    if (error) throw error;
    return data || [];
  }

  async function subscribeTruppen(callback) {
    const client = await getClient();
    return client
      .channel("realtime-truppen-stable")
      .on("postgres_changes", { event: "*", schema: "public", table: "nsk_players" }, payload => callback("players", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "nsk_coaches" }, payload => callback("coaches", payload))
      .subscribe();
  }

  async function subscribeMatchConfigs(callback) {
    const client = await getClient();
    return client
      .channel("realtime-match-configs-stable")
      .on("postgres_changes", { event: "*", schema: "public", table: "nsk_match_configs" }, payload => callback(payload))
      .subscribe();
  }

  return {
    getTeamId,
    listPlayers,
    addPlayer,
    updatePlayer,
    deletePlayer,
    savePlayerOrder,
    listCoaches,
    addCoach,
    updateCoach,
    deleteCoach,
    saveCoachOrder,
    listPools,
    addPool,
    getCurrentPoolId,
    upsertMatchConfig,
    getMatchConfig,
    listGoalieStats,
    subscribeTruppen,
    subscribeMatchConfigs
  };
})();
