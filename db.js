
window.DB = (() => {
  const LOCAL = "nsk_v72";

  function defaults(){
    return { pool: { id:"", cloud_id:"", name:"", players:[], goalie:"", shiftSeconds:90, matches:[] } };
  }

  function load(){
    try{
      return JSON.parse(localStorage.getItem(LOCAL)) || defaults();
    }catch{
      return defaults();
    }
  }

  function save(data){
    localStorage.setItem(LOCAL, JSON.stringify(data));
  }

  async function upsertPool(pool){
    const client = Auth.getClient();
    if(!client) throw new Error("Ingen Supabase-klient.");
    const row = {
      cloud_id: pool.cloud_id,
      payload: pool,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from("pools").upsert(row,{onConflict:"cloud_id"});
    if(error) throw error;
  }

  async function fetchPool(cloud_id){
    const client = Auth.getClient();
    const { data, error } = await client.from("pools").select("payload").eq("cloud_id", cloud_id).single();
    if(error) throw error;
    return data.payload;
  }

  function subscribePool(cloud_id, callback){
    const client = Auth.getClient();
    if(!client) return null;
    return client.channel("pools-" + cloud_id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "pools",
        filter: "cloud_id=eq." + cloud_id
      }, payload => {
        if(payload?.new?.payload) callback(payload.new.payload);
      })
      .subscribe();
  }

  return { load, save, upsertPool, fetchPool, subscribePool };
})();
