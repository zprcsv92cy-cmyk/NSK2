window.DB = (() => {

const TEAM_NAME="NSK Team 18";
const TEAM_SEASON="2026";

async function getClient(){
  if(window.Auth?.init) await Auth.init();
  return Auth.getClient();
}

async function getTeamId(){

  const client=await getClient();

  let {data}=await client
  .from("nsk_teams")
  .select("id")
  .eq("name",TEAM_NAME)
  .eq("season",TEAM_SEASON)
  .maybeSingle();

  if(data?.id) return data.id;

  const inserted=await client
  .from("nsk_teams")
  .insert({name:TEAM_NAME,season:TEAM_SEASON})
  .select("id")
  .single();

  return inserted.data.id;

}

/* PLAYERS */

async function listPlayers(){

  const client=await getClient();
  const teamId=await getTeamId();

  const {data,error}=await client
  .from("nsk_players")
  .select("*")
  .eq("team_id",teamId)
  .order("full_name");

  if(error) throw error;
  return data||[];

}

async function addPlayer(name){

  const client=await getClient();
  const teamId=await getTeamId();

  const {data,error}=await client
  .from("nsk_players")
  .insert({team_id:teamId,full_name:name})
  .select("*")
  .single();

  if(error) throw error;
  return data;

}

async function updatePlayer(id,name){

  const client=await getClient();

  const {error}=await client
  .from("nsk_players")
  .update({full_name:name})
  .eq("id",id);

  if(error) throw error;

}

async function deletePlayer(id){

  const client=await getClient();

  const {error}=await client
  .from("nsk_players")
  .delete()
  .eq("id",id);

  if(error) throw error;

}

/* COACHES */

async function listCoaches(){

  const client=await getClient();
  const teamId=await getTeamId();

  const {data,error}=await client
  .from("nsk_coaches")
  .select("*")
  .eq("team_id",teamId)
  .order("full_name");

  if(error) throw error;
  return data||[];

}

async function addCoach(name){

  const client=await getClient();
  const teamId=await getTeamId();

  const {data,error}=await client
  .from("nsk_coaches")
  .insert({
    team_id:teamId,
    full_name:name,
    role:"Tränare"
  })
  .select("*")
  .single();

  if(error) throw error;
  return data;

}

async function updateCoach(id,name){

  const client=await getClient();

  const {error}=await client
  .from("nsk_coaches")
  .update({full_name:name})
  .eq("id",id);

  if(error) throw error;

}

async function deleteCoach(id){

  const client=await getClient();

  const {error}=await client
  .from("nsk_coaches")
  .delete()
  .eq("id",id);

  if(error) throw error;

}

/* POOLS */

async function listPools(){

  const client=await getClient();
  const teamId=await getTeamId();

  const {data,error}=await client
  .from("nsk_pools")
  .select("*")
  .eq("team_id",teamId)
  .order("created_at",{ascending:false});

  if(error) throw error;
  return data||[];

}

async function addPool(payload){

  const client=await getClient();
  const teamId=await getTeamId();

  const row={
    team_id:teamId,
    title:payload.title||"Poolspel",
    place:payload.place||"",
    pool_date:payload.pool_date||null,
    status:payload.status||"Aktiv"
  };

  const {data,error}=await client
  .from("nsk_pools")
  .insert(row)
  .select("*")
  .single();

  if(error) throw error;
  return data;

}

/* GOALIE STATS */

async function listGoalieStats(){

  const client=await getClient();

  const {data,error}=await client
  .from("nsk_goalie_stats")
  .select("goalie_name,match_id");

  if(error) throw error;
  return data||[];

}

/* REALTIME */

async function subscribeTruppen(callback){

  const client=await getClient();

  return client.channel("truppen")

  .on("postgres_changes",
  {event:"*",schema:"public",table:"nsk_players"},
  ()=>callback("players"))

  .on("postgres_changes",
  {event:"*",schema:"public",table:"nsk_coaches"},
  ()=>callback("coaches"))

  .subscribe();

}

return{
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
listGoalieStats,
subscribeTruppen
};

})();