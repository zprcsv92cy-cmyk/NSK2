window.DB = (() => {

const TEAM_NAME = "NSK Team 18";
const TEAM_SEASON = "2026";

async function getClient(){
  if(window.Auth?.init) await Auth.init();
  return Auth.getClient();
}

async function getTeamId(){

  const client = await getClient();

  const { data } = await client
    .from("nsk_teams")
    .select("id")
    .eq("name", TEAM_NAME)
    .eq("season", TEAM_SEASON)
    .maybeSingle();

  if(data?.id) return data.id;

  const inserted = await client
    .from("nsk_teams")
    .insert({ name: TEAM_NAME, season: TEAM_SEASON })
    .select("id")
    .single();

  return inserted.data.id;
}

async function listPlayers(){

  const client = await getClient();
  const teamId = await getTeamId();

  const { data } = await client
    .from("nsk_players")
    .select("*")
    .eq("team_id", teamId)
    .order("full_name");

  return data || [];
}

async function listCoaches(){

  const client = await getClient();
  const teamId = await getTeamId();

  const { data } = await client
    .from("nsk_coaches")
    .select("*")
    .eq("team_id", teamId)
    .order("full_name");

  return data || [];
}

async function listPools(){

  const client = await getClient();
  const teamId = await getTeamId();

  const { data } = await client
    .from("nsk_pools")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at",{ascending:false});

  return data || [];
}

async function addPool(payload){

  const client = await getClient();
  const teamId = await getTeamId();

  const row = {
    team_id: teamId,
    title: payload.title,
    place: payload.place,
    pool_date: payload.pool_date,
    status: payload.status,
    teams: payload.teams,
    matches: payload.matches,
    players_on_field: payload.players_on_field,
    periods: payload.periods,
    period_time: payload.period_time,
    sub_time: payload.sub_time
  };

  const { data } = await client
    .from("nsk_pools")
    .insert(row)
    .select("*")
    .single();

  return data;
}

async function updatePool(id,payload){

  const client = await getClient();

  const { data } = await client
    .from("nsk_pools")
    .update(payload)
    .eq("id",id)
    .select("*")
    .single();

  return data;
}

async function getPool(id){

  const client = await getClient();

  const { data } = await client
    .from("nsk_pools")
    .select("*")
    .eq("id",id)
    .single();

  return data;
}

async function deletePool(id){

  const client = await getClient();

  await client
    .from("nsk_pools")
    .delete()
    .eq("id",id);

  return true;
}

async function getPoolTeamMatchConfig(poolId,lagNo,matchNo){

  const client = await getClient();
  const teamId = await getTeamId();

  const { data } = await client
    .from("nsk_pool_team_matches")
    .select("*")
    .eq("team_id",teamId)
    .eq("pool_id",poolId)
    .eq("lag_no",lagNo)
    .eq("match_no",matchNo)
    .maybeSingle();

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

    start_time: payload.start_time,
    opponent: payload.opponent,
    plan: payload.plan,
    player_count: payload.player_count,

    goalie_player_id: payload.goalie_player_id,
    coach_ids: payload.coach_ids,

    player1_id: payload.player1_id,
    player2_id: payload.player2_id,
    player3_id: payload.player3_id,
    player4_id: payload.player4_id,
    player5_id: payload.player5_id,
    player6_id: payload.player6_id,
    player7_id: payload.player7_id,
    player8_id: payload.player8_id,
    player9_id: payload.player9_id,
    player10_id: payload.player10_id,
    player11_id: payload.player11_id,
    player12_id: payload.player12_id,
    player13_id: payload.player13_id,
    player14_id: payload.player14_id,
    player15_id: payload.player15_id,
    player16_id: payload.player16_id,
    player17_id: payload.player17_id,
    player18_id: payload.player18_id,
    player19_id: payload.player19_id,
    player20_id: payload.player20_id,
    player21_id: payload.player21_id,
    player22_id: payload.player22_id,
    player23_id: payload.player23_id,
    player24_id: payload.player24_id,
    player25_id: payload.player25_id
  };

  const { data } = await client
    .from("nsk_pool_team_matches")
    .upsert(row,{
      onConflict:"team_id,pool_id,lag_no,match_no"
    })
    .select("*")
    .single();

  return data;
}

return {
getTeamId,
listPlayers,
listCoaches,
listPools,
addPool,
updatePool,
getPool,
deletePool,
getPoolTeamMatchConfig,
savePoolTeamMatchConfig
};

})();