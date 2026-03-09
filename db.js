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

    throw new Error("Inget lag hittades i nsk_teams");
  }

  async function listPlayers(){
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_players")
      .select("id, full_name, team_id")
      .eq("team_id", teamId)
      .order("full_name",{ascending:true});

    if(error) throw error;
    return data || [];
  }

  async function listCoaches(){
    const client = await getClient();
    const teamId = await getTeamId();

    const { data, error } = await client
      .from("nsk_coaches")
      .select("id, full_name, team_id")
      .eq("team_id",teamId)
      .order("full_name",{ascending:true});

    if(error) throw error;
    return data || [];
  }

  async function addPlayer(name){
    const client = await getClient();
    const teamId = await getTeamId();
    const { error } = await client
      .from("nsk_players")
      .insert({ team_id: teamId, full_name: name });
    if(error) throw error;
  }

  async function addCoach(name){
    const client = await getClient();
    const teamId = await getTeamId();
    const { error } = await client
      .from("nsk_coaches")
      .insert({ team_id: teamId, full_name: name });
    if(error) throw error;
  }

  async function getDebugInfo(){
    const out = {
      teamLookup: null,
      teamsCount: null,
      playersCountForTeam: null,
      coachesCountForTeam: null,
      firstTeam: null,
      dbError: null
    };

    try{
      const client = await getClient();

      const teams = await client.from("nsk_teams").select("id,name,season");
      if(teams.error) throw teams.error;

      out.teamsCount = (teams.data || []).length;
      out.firstTeam = teams.data?.[0] || null;

      const teamId = await getTeamId();
      out.teamLookup = teamId;

      const players = await client.from("nsk_players").select("id,team_id").eq("team_id", teamId);
      if(players.error) throw players.error;
      out.playersCountForTeam = (players.data || []).length;

      const coaches = await client.from("nsk_coaches").select("id,team_id").eq("team_id", teamId);
      if(coaches.error) throw coaches.error;
      out.coachesCountForTeam = (coaches.data || []).length;

    }catch(err){
      out.dbError = err.message || String(err);
    }

    return out;
  }

  return {
    getTeamId,
    listPlayers,
    listCoaches,
    addPlayer,
    addCoach,
    getDebugInfo
  };
})();
