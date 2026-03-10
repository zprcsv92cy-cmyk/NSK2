window.DB = (() => {
  const TEAM_NAME = "NSK Team 18";
  const TEAM_SEASON = "2026";

  async function getClient(){
    if(window.Auth?.init) await Auth.init();
    if(!window.Auth?.getClient) throw new Error("Auth.getClient saknas i auth.js");
    return Auth.getClient();
  }

  async function getTeamId(){
    const client = await getClient();

    const exact = await client
      .from("nsk_teams")
      .select("id,name,season")
      .eq("name", TEAM_NAME)
      .eq("season", TEAM_SEASON)
      .limit(1)
      .maybeSingle();

    if(exact.error) throw exact.error;
    if(exact.data?.id) return exact.data.id;

    const byName = await client
      .from("nsk_teams")
      .select("id,name,season")
      .eq("name", TEAM_NAME)
      .limit(1)
      .maybeSingle();

    if(byName.error) throw byName.error;
    if(byName.data?.id) return byName.data.id;

    const anyTeam = await client
      .from("nsk_teams")
      .select("id,name,season")
      .limit(1)
      .maybeSingle();

    if(anyTeam.error) throw anyTeam.error;
    if(anyTeam.data?.id) return anyTeam.data.id;

    const inserted = await client
      .from("nsk_teams")
      .insert({ name: TEAM_NAME, season: TEAM_SEASON })
      .select("id")
      .single();

    if(inserted.error) throw inserted.error;
    return inserted.data.id;
  }

  async function listPlayers(){
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_players")
      .select("*")
      .eq("team_id", teamId)
      .order("full_name", { ascending: true });

    if(error) throw error;
    return data || [];
  }

  async function addPlayer(name){
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_players")
      .insert({
        team_id: teamId,
        full_name: String(name || "").trim()
      })
      .select("*")
      .single();

    if(error) throw error;
    return data;
  }

  async function updatePlayer(id, name){
    const client = await getClient();

    const { error } = await client
      .from("nsk_players")
      .update({ full_name: String(name || "").trim() })
      .eq("id", id);

    if(error) throw error;
    return true;
  }

  async function deletePlayer(id){
    const client = await getClient();

    const { error } = await client
      .from("nsk_players")
      .delete()
      .eq("id", id);

    if(error) throw error;
    return true;
  }

  async function listCoaches(){
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_coaches")
      .select("*")
      .eq("team_id", teamId)
      .order("full_name", { ascending: true });

    if(error) throw error;
    return data || [];
  }

  async function addCoach(name){
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_coaches")
      .insert({
        team_id: teamId,
        full_name: String(name || "").trim(),
        role: "Tränare"
      })
      .select("*")
      .single();

    if(error) throw error;
    return data;
  }

  async function updateCoach(id, name){
    const client = await getClient();

    const { error } = await client
      .from("nsk_coaches")
      .update({ full_name: String(name || "").trim() })
      .eq("id", id);

    if(error) throw error;
    return true;
  }

  async function deleteCoach(id){
    const client = await getClient();

    const { error } = await client
      .from("nsk_coaches")
      .delete()
      .eq("id", id);

    if(error) throw error;
    return true;
  }

  async function listPools(){
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_pools")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if(error) throw error;
    return data || [];
  }

  async function addPool(payload){
    const client = await getClient();
    const teamId = await getTeamId();

    const row = {
      team_id: teamId,
      title: payload.title || "Poolspel",
      place: payload.place || "",
      pool_date: payload.pool_date || null,
      status: payload.status || "Aktiv",
      teams: payload.teams ?? null,
      matches: payload.matches ?? null,
      players_on_field: payload.players_on_field ?? null,
      periods: payload.periods ?? null,
      period_time: payload.period_time ?? null,
      sub_time: payload.sub_time ?? null
    };

    const { data, error } = await client
      .from("nsk_pools")
      .insert(row)
      .select("*")
      .single();

    if(error) throw error;
    return data;
  }

  async function updatePool(id, payload){
    const client = await getClient();

    const row = {
      title: payload.title || "Poolspel",
      place: payload.place || "",
      pool_date: payload.pool_date || null,
      status: payload.status || "Aktiv",
      teams: payload.teams ?? null,
      matches: payload.matches ?? null,
      players_on_field: payload.players_on_field ?? null,
      periods: payload.periods ?? null,
      period_time: payload.period_time ?? null,
      sub_time: payload.sub_time ?? null
    };

    const { data, error } = await client
      .from("nsk_pools")
      .update(row)
      .eq("id", id)
      .select("*")
      .single();

    if(error) throw error;
    return data;
  }

  async function getPool(id){
    const client = await getClient();

    const { data, error } = await client
      .from("nsk_pools")
      .select("*")
      .eq("id", id)
      .single();

    if(error) throw error;
    return data;
  }

  async function deletePool(id){
    const client = await getClient();

    const { error } = await client
      .from("nsk_pools")
      .delete()
      .eq("id", id);

    if(error) throw error;
    return true;
  }

  async function getPoolTeamMatchConfig(poolId, lagNo, matchNo){
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

    if(error) throw error;
    return data || null;
  }

  async function savePoolTeamMatchConfig(payload){
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
      goalie_player_id: payload.goalie_player_id || null,
      coach_id: payload.coach_id || null,
      player1_id: payload.player1_id || null,
      player2_id: payload.player2_id || null,
      player3_id: payload.player3_id || null,
      player4_id: payload.player4_id || null,
      player5_id: payload.player5_id || null,
      player6_id: payload.player6_id || null,
      player7_id: payload.player7_id || null,
      player8_id: payload.player8_id || null,
      player9_id: payload.player9_id || null,
      player10_id: payload.player10_id || null
    };

    const { data, error } = await client
      .from("nsk_pool_team_matches")
      .upsert(row, { onConflict: "team_id,pool_id,lag_no,match_no" })
      .select("*")
      .single();

    if(error) throw error;
    return data;
  }

  async function listGoalieStats(){
    const client = await getClient();

    const { data, error } = await client
      .from("nsk_goalie_stats")
      .select("goalie_name,match_id");

    if(error) throw error;
    return data || [];
  }

  async function subscribeTruppen(callback){
    const client = await getClient();

    return client
      .channel("truppen")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nsk_players" },
        () => callback("players")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nsk_coaches" },
        () => callback("coaches")
      )
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
    getPoolTeamMatchConfig,
    savePoolTeamMatchConfig,
    listGoalieStats,
    subscribeTruppen
  };
})();