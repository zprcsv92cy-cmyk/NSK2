// db.js – Supabase compatible version

window.DB = (() => {

const TEAM_NAME = "NSK Team 18";
const TEAM_SEASON = "2026";

async function client(){
  if(window.Auth?.init) await window.Auth.init();
  return window.Auth?.getClient?.();
}

async function teamId(){
  const c = await client();
  const {data} = await c
    .from("nsk_teams")
    .select("id")
    .eq("name",TEAM_NAME)
    .eq("season",TEAM_SEASON)
    .maybeSingle();
  return data?.id;
}

/* PLAYERS */

async function listPlayers(){
  const c = await client();
  const t = await teamId();
  const {data} = await c
    .from("nsk_players")
    .select("*")
    .eq("team_id",t)
    .order("full_name");
  return data||[];
}

async function addPlayer(name){
  const c = await client();
  const t = await teamId();
  const {data} = await c
    .from("nsk_players")
    .insert({team_id:t,full_name:name})
    .select()
    .single();
  return data;
}

async function deletePlayer(id){
  const c = await client();
  await c.from("nsk_players").delete().eq("id",id);
}

/* COACHES */

async function listCoaches(){
  const c = await client();
  const t = await teamId();
  const {data} = await c
    .from("nsk_coaches")
    .select("*")
    .eq("team_id",t)
    .order("full_name");
  return data||[];
}

async function addCoach(name){
  const c = await client();
  const t = await teamId();
  const {data} = await c
    .from("nsk_coaches")
    .insert({team_id:t,full_name:name})
    .select()
    .single();
  return data;
}

/* POOLS */

async function listPools(){
  const c = await client();
  const t = await teamId();
  const {data} = await c
    .from("nsk_pools")
    .select("*")
    .eq("team_id",t)
    .order("pool_date",{ascending:false});
  return data||[];
}

async function addPool(p){
  const c = await client();
  const t = await teamId();
  const {data} = await c
    .from("nsk_pools")
    .insert({...p,team_id:t})
    .select()
    .single();
  return data;
}

/* MATCH CONFIG */

async function saveMatchConfig(row){
  const c = await client();

  const {data:existing} = await c
    .from("nsk_pool_team_match_configs")
    .select("id")
    .eq("pool_id",row.pool_id)
    .eq("lag_no",row.lag_no)
    .eq("match_no",row.match_no)
    .maybeSingle();

  if(existing){
    await c
      .from("nsk_pool_team_match_configs")
      .update(row)
      .eq("id",existing.id);
    return existing.id;
  }

  const {data} = await c
    .from("nsk_pool_team_match_configs")
    .insert(row)
    .select()
    .single();

  return data.id;
}

/* LINEUP */

async function saveLineup(matchConfigId,players,coaches){

  const c = await client();

  await c
    .from("nsk_lineups")
    .delete()
    .eq("match_config_id",matchConfigId);

  const rows=[];
  let sort=1;

  players.forEach(p=>{
    rows.push({
      match_config_id:matchConfigId,
      person_type:"player",
      person_id:p,
      sort_order:sort++
    })
  })

  coaches.forEach(ca=>{
    rows.push({
      match_config_id:matchConfigId,
      person_type:"coach",
      person_id:ca,
      sort_order:sort++
    })
  })

  if(rows.length)
    await c.from("nsk_lineups").insert(rows);

}

/* SHIFT SCHEMA */

async function listShiftSchema(poolId,lag,match){

  const c = await client();

  const {data} = await c
    .from("nsk_shift_schemas")
    .select("*")
    .eq("pool_id",poolId)
    .eq("lag_no",lag)
    .eq("match_no",match)
    .order("shift_no");

  return data||[];
}

async function saveShiftSchema(poolId,lag,match,shifts){

  const c = await client();

  await c
    .from("nsk_shift_schemas")
    .delete()
    .eq("pool_id",poolId)
    .eq("lag_no",lag)
    .eq("match_no",match);

  const rows = shifts.map((s,i)=>({
    pool_id:poolId,
    lag_no:lag,
    match_no:match,
    shift_no:i+1,
    period_no:s.period_no,
    time_left:s.time_left,
    players_json:s.players
  }));

  if(rows.length)
    await c.from("nsk_shift_schemas").insert(rows);

}

return{
listPlayers,
addPlayer,
deletePlayer,
listCoaches,
addCoach,
listPools,
addPool,
saveMatchConfig,
saveLineup,
listShiftSchema,
saveShiftSchema
};

})();