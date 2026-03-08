
// db.js — NSK Team 18 (robust team lookup + realtime compatible)

window.DB = (() => {

  const TEAM_NAME = "NSK Team 18";
  const TEAM_SEASON = "2026";

  function getClient(){
    if(window.Auth?.getClient) return window.Auth.getClient();
    throw new Error("Supabase client saknas");
  }

  async function requireClient(){
    if(window.Auth?.init) await window.Auth.init();
    return getClient();
  }

  async function getTeamId(){
    const client = await requireClient();

    let { data, error } = await client
      .from("nsk_teams")
      .select("id")
      .eq("name", TEAM_NAME)
      .eq("season", TEAM_SEASON)
      .limit(1)
      .maybeSingle();

    if(error) throw error;
    if(data?.id) return data.id;

    const fallback = await client
      .from("nsk_teams")
      .select("id")
      .eq("name", TEAM_NAME)
      .limit(1)
      .maybeSingle();

    if(fallback.error) throw fallback.error;
    if(fallback.data?.id) return fallback.data.id;

    const anyTeam = await client
      .from("nsk_teams")
      .select("id")
      .limit(1)
      .maybeSingle();

    if(anyTeam.error) throw anyTeam.error;
    if(anyTeam.data?.id) return anyTeam.data.id;

    const inserted = await client
      .from("nsk_teams")
      .insert({
        name: TEAM_NAME,
        season: TEAM_SEASON
      })
      .select("id")
      .single();

    if(inserted.error) throw inserted.error;

    return inserted.data.id;
  }

  async function listPlayers(){
    const client = await requireClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_players")
      .select("id, full_name, jersey_number")
      .eq("team_id", teamId)
      .order("full_name",{ascending:true});

    if(error) throw error;
    return data || [];
  }

  async function addPlayer(name){
    const client = await requireClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_players")
      .insert({
        team_id: teamId,
        full_name: name
      })
      .select("*")
      .single();

    if(error) throw error;
    return data;
  }

  async function deletePlayer(id){
    const client = await requireClient();

    const { error } = await client
      .from("nsk_players")
      .delete()
      .eq("id",id);

    if(error) throw error;
  }

  async function listCoaches(){
    const client = await requireClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_coaches")
      .select("id, full_name, role")
      .eq("team_id",teamId)
      .order("full_name",{ascending:true});

    if(error) throw error;
    return data || [];
  }

  async function addCoach(name){
    const client = await requireClient();
    const teamId = await getTeamId();

    const { data, error } = await client
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

  async function listPools(){
    const client = await requireClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_pools")
      .select("*")
      .eq("team_id",teamId)
      .order("pool_date",{ascending:false});

    if(error) throw error;
    return data || [];
  }

  async function addPool(payload){
    const client = await requireClient();
    const teamId = await getTeamId();

    payload.team_id = teamId;

    const { data, error } = await client
      .from("nsk_pools")
      .insert(payload)
      .select("*")
      .single();

    if(error) throw error;
    return data;
  }

  async function listMatchesByPool(poolId){
    const client = await requireClient();

    const { data, error } = await client
      .from("nsk_matches")
      .select("*")
      .eq("pool_id",poolId)
      .order("created_at",{ascending:true});

    if(error) throw error;
    return data || [];
  }

  async function addMatch(payload){
    const client = await requireClient();

    const { data, error } = await client
      .from("nsk_matches")
      .insert(payload)
      .select("*")
      .single();

    if(error) throw error;
    return data;
  }

  async function listLineups(matchId){
    const client = await requireClient();

    const { data, error } = await client
      .from("nsk_lineups")
      .select(`
        id,
        lineup_no,
        nsk_lineup_players(
          player_id,
          nsk_players(full_name)
        )
      `)
      .eq("match_id",matchId)
      .order("lineup_no",{ascending:true});

    if(error) throw error;

    return (data || []).map(l => ({
      id:l.id,
      lineup_no:l.lineup_no,
      players:(l.nsk_lineup_players||[]).map(p=>p.nsk_players)
    }));
  }

  async function subscribe(table,callback){
    const client = await requireClient();

    const channel = client
      .channel("realtime-"+table)
      .on(
        "postgres_changes",
        { event:"*", schema:"public", table:table },
        payload => callback(payload)
      )
      .subscribe();

    return channel;
  }

  return {
    getTeamId,
    listPlayers,
    addPlayer,
    deletePlayer,
    listCoaches,
    addCoach,
    listPools,
    addPool,
    listMatchesByPool,
    addMatch,
    listLineups,
    subscribe
  };

})();
