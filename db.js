window.DB = (() => {

  async function getClient(){
    if(window.Auth?.init) await Auth.init();
    return Auth.getClient();
  }

  async function getTeamId(){
    const client = await getClient();

    const { data } = await client
      .from("nsk_teams")
      .select("id")
      .limit(1)
      .maybeSingle();

    if(data?.id) return data.id;

    throw new Error("Team saknas i nsk_teams");
  }

  async function listPlayers(){
    const client = await getClient();
    const teamId = await getTeamId();

    const { data } = await client
      .from("nsk_players")
      .select("id, full_name")
      .eq("team_id", teamId)
      .order("full_name",{ascending:true});

    return data || [];
  }

  async function addPlayer(name){
    const client = await getClient();
    const teamId = await getTeamId();

    await client
      .from("nsk_players")
      .insert({ team_id: teamId, full_name: name });
  }

  async function listCoaches(){
    const client = await getClient();
    const teamId = await getTeamId();

    const { data } = await client
      .from("nsk_coaches")
      .select("id, full_name")
      .eq("team_id",teamId)
      .order("full_name",{ascending:true});

    return data || [];
  }

  async function addCoach(name){
    const client = await getClient();
    const teamId = await getTeamId();

    await client
      .from("nsk_coaches")
      .insert({ team_id:teamId, full_name:name });
  }

  return {
    listPlayers,
    addPlayer,
    listCoaches,
    addCoach
  };

})();
