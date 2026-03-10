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

  let exact = await client
    .from("nsk_teams")
    .select("id,name,season")
    .eq("name", TEAM_NAME)
    .eq("season", TEAM_SEASON)
    .limit(1)
    .maybeSingle();

  if(exact.error) throw exact.error;
  if(exact.data?.id) return exact.data.id;

  let byName = await client
    .from("nsk_teams")
    .select("id,name,season")
    .eq("name", TEAM_NAME)
    .limit(1)
    .maybeSingle();

  if(byName.error) throw byName.error;
  if(byName.data?.id) return byName.data.id;

  let anyTeam = await client
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

/* PLAYERS */

async function listPlayers(){
  const client = await getClient();
  const teamId = await getTeamId();

  const { data, error } = await client
    .from("nsk_players")
    .select("*")
    .eq("team_id", teamId)
    .order("full_name", { ascending:true });

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

/* COACHES */

async function listCoaches(){
  const client = await getClient();
  const teamId = await getTeamId();

  const { data, error } = await client
    .from("nsk_coaches")
    .select("*")
    .eq("team_id", teamId)
    .order("full_name", { ascending:true });

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

/* POOLS */

async function listPools(){
  const client = await getClient();
  const teamId = await getTeamId();

  const { data, error } = await client
    .from("nsk_pools")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending:false });

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

/* GOALIE STATS */

async function listGoalieStats(){
  const client = await getClient();

  const { data, error } = await client
    .from("nsk_goalie_stats")
    .select("goalie_name,match_id");

  if(error) throw error;
  return data || [];
}

/* REALTIME */

async function subscribeTruppen(callback){
  const client = await getClient();

  return client
    .channel("truppen")
    .on("postgres_changes",
      { event:"*", schema:"public", table:"nsk_players" },
      () => callback("players")
    )
    .on("postgres_changes",
      { event:"*", schema:"public", table:"nsk_coaches" },
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
  listGoalieStats,
  subscribeTruppen
};

})();
