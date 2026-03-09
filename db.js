// db.js patch — truppen redigera / ta bort
(function(){
  if(!window.DB) return;

  async function _getClient(){
    if(window.Auth?.init) await Auth.init();
    if(!window.Auth?.getClient) throw new Error("Auth.getClient saknas i auth.js");
    return Auth.getClient();
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

  window.DB.updatePlayer = updatePlayer;
  window.DB.deletePlayer = deletePlayer;
  window.DB.updateCoach = updateCoach;
  window.DB.deleteCoach = deleteCoach;
})();
