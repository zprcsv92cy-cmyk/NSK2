// NSK2 db.js V2 (Supabase tables)
window.DB = (()=>{

async function client(){
  if(window.Auth?.getClient) return Auth.getClient();
  if(window.supabase && window.APP_CONFIG){
    if(!window._c){
      window._c = supabase.createClient(
        APP_CONFIG.SUPABASE_URL,
        APP_CONFIG.SUPABASE_KEY
      );
    }
    return window._c;
  }
}

async function teamId(){
  const c = await client();
  const {data} = await c.from("nsk_teams")
    .select("id")
    .eq("name","NSK Team 18")
    .eq("season","2026")
    .single();
  return data.id;
}

async function listPlayers(){
  const c = await client();
  const id = await teamId();
  const {data} = await c.from("nsk_players")
    .select("*")
    .eq("team_id",id)
    .order("full_name");
  return data||[];
}

async function addPlayer(name){
  const c = await client();
  const id = await teamId();
  await c.from("nsk_players").insert({
    team_id:id,
    full_name:name
  });
}

async function listCoaches(){
  const c = await client();
  const id = await teamId();
  const {data} = await c.from("nsk_coaches")
    .select("*")
    .eq("team_id",id)
    .order("full_name");
  return data||[];
}

async function addCoach(name){
  const c = await client();
  const id = await teamId();
  await c.from("nsk_coaches").insert({
    team_id:id,
    full_name:name,
    role:"Tränare"
  });
}

async function listPools(){
  const c = await client();
  const id = await teamId();
  const {data} = await c.from("nsk_pools")
    .select("*")
    .eq("team_id",id)
    .order("pool_date",{ascending:false});
  return data||[];
}

async function addPool(p){
  const c = await client();
  const id = await teamId();
  const {data} = await c.from("nsk_pools")
    .insert({...p,team_id:id})
    .select()
    .single();
  return data;
}

async function listMatchesByPool(pool){
  const c = await client();
  const {data} = await c.from("nsk_matches")
    .select("*")
    .eq("pool_id",pool);
  return data||[];
}

async function addMatch(m){
  const c = await client();
  const {data} = await c.from("nsk_matches")
    .insert(m)
    .select()
    .single();
  return data;
}

async function listLineups(match){
  const c = await client();
  const {data} = await c.from("nsk_lineups")
    .select("id,lineup_no,nsk_lineup_players(player_id,nsk_players(full_name))")
    .eq("match_id",match)
    .order("lineup_no");
  return (data||[]).map(l=>({
    lineup_no:l.lineup_no,
    players:(l.nsk_lineup_players||[])
      .map(x=>x.nsk_players)
  }));
}

async function replaceLineups(match,lineups){
  const c = await client();

  await c.from("nsk_lineups")
    .delete()
    .eq("match_id",match);

  for(const l of lineups){
    const {data} = await c.from("nsk_lineups")
      .insert({match_id:match,lineup_no:l.lineup_no})
      .select()
      .single();

    const rows=l.player_ids.map(p=>({
      lineup_id:data.id,
      player_id:p
    }));

    await c.from("nsk_lineup_players").insert(rows);
  }
}

return{
listPlayers,
addPlayer,
listCoaches,
addCoach,
listPools,
addPool,
listMatchesByPool,
addMatch,
listLineups,
replaceLineups
};

})();