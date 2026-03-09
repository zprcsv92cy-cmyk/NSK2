// db.js patch — NSK V14 Truppen (edit, delete, reorder)
(function(){
  if(!window.DB) return;

  async function _getClient(){
    if(window.Auth?.init) await Auth.init();
    if(!window.Auth?.getClient) throw new Error("Auth.getClient saknas i auth.js");
    return Auth.getClient();
  }

  async function _getTeamId(){
    if(window.DB.getTeamId) return window.DB.getTeamId();
    throw new Error("DB.getTeamId saknas");
  }

  async function listPlayersV14(){
    const client = await _getClient();
    const teamId = await _getTeamId();
    const { data, error } = await client
      .from("nsk_players")
      .select("id, full_name, sort_order")
      .eq("team_id", teamId)
      .order("sort_order", { ascending:true, nullsFirst:false })
      .order("full_name", { ascending:true });

    if(error) throw error;
    return data || [];
  }

  async function listCoachesV14(){
    const client = await _getClient();
    const teamId = await _getTeamId();
    const { data, error } = await client
      .from("nsk_coaches")
      .select("id, full_name, sort_order")
      .eq("team_id", teamId)
      .order("sort_order", { ascending:true, nullsFirst:false })
      .order("full_name", { ascending:true });

    if(error) throw error;
    return data || [];
  }

  async function addPlayerV14(name){
    const client = await _getClient();
    const teamId = await _getTeamId();

    const { data:maxData } = await client
      .from("nsk_players")
      .select("sort_order")
      .eq("team_id", teamId)
      .order("sort_order", { ascending:false })
      .limit(1);

    const nextSort = ((maxData && maxData[0] && maxData[0].sort_order) || 0) + 1;

    const { data, error } = await client
      .from("nsk_players")
      .insert({ team_id: teamId, full_name: String(name || "").trim(), sort_order: nextSort })
      .select("*")
      .single();

    if(error) throw error;
    return data;
  }

  async function addCoachV14(name){
    const client = await _getClient();
    const teamId = await _getTeamId();

    const { data:maxData } = await client
      .from("nsk_coaches")
      .select("sort_order")
      .eq("team_id", teamId)
      .order("sort_order", { ascending:false })
      .limit(1);

    const nextSort = ((maxData && maxData[0] && maxData[0].sort_order) || 0) + 1;

    const { data, error } = await client
      .from("nsk_coaches")
      .insert({ team_id: teamId, full_name: String(name || "").trim(), role:"Tränare", sort_order: nextSort })
      .select("*")
      .single();

    if(error) throw error;
    return data;
  }

  async function updatePlayer(id, fullName){
    const client = await _getClient();
    const { data, error } = await client
      .from("nsk_players")
      .update({ full_name: String(fullName || "").trim() })
      .eq("id", id)
      .select("*")
      .single();
    if(error) throw error;
    return data;
  }

  async function deletePlayer(id){
    const client = await _getClient();
    const { error } = await client
      .from("nsk_players")
      .delete()
      .eq("id", id);
    if(error) throw error;
    return true;
  }

  async function updateCoach(id, fullName){
    const client = await _getClient();
    const { data, error } = await client
      .from("nsk_coaches")
      .update({ full_name: String(fullName || "").trim() })
      .eq("id", id)
      .select("*")
      .single();
    if(error) throw error;
    return data;
  }

  async function deleteCoach(id){
    const client = await _getClient();
    const { error } = await client
      .from("nsk_coaches")
      .delete()
      .eq("id", id);
    if(error) throw error;
    return true;
  }

  async function savePlayerOrder(ids){
    const client = await _getClient();
    for(let i=0;i<ids.length;i++){
      const { error } = await client
        .from("nsk_players")
        .update({ sort_order: i + 1 })
        .eq("id", ids[i]);
      if(error) throw error;
    }
    return true;
  }

  async function saveCoachOrder(ids){
    const client = await _getClient();
    for(let i=0;i<ids.length;i++){
      const { error } = await client
        .from("nsk_coaches")
        .update({ sort_order: i + 1 })
        .eq("id", ids[i]);
      if(error) throw error;
    }
    return true;
  }

  async function subscribeTruppen(callback){
    const client = await _getClient();
    const ch = client
      .channel("realtime-truppen-v14")
      .on("postgres_changes", { event:"*", schema:"public", table:"nsk_players" }, payload => callback("players", payload))
      .on("postgres_changes", { event:"*", schema:"public", table:"nsk_coaches" }, payload => callback("coaches", payload))
      .subscribe();
    return ch;
  }

  window.DB.listPlayers = listPlayersV14;
  window.DB.listCoaches = listCoachesV14;
  window.DB.addPlayer = addPlayerV14;
  window.DB.addCoach = addCoachV14;
  window.DB.updatePlayer = updatePlayer;
  window.DB.deletePlayer = deletePlayer;
  window.DB.updateCoach = updateCoach;
  window.DB.deleteCoach = deleteCoach;
  window.DB.savePlayerOrder = savePlayerOrder;
  window.DB.saveCoachOrder = saveCoachOrder;
  window.DB.subscribeTruppen = subscribeTruppen;
})();
