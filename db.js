window.DB=(()=>{
const client=()=>Auth.getClient();

async function listPlayers(){
const {data}=await client().from("nsk_players").select("*").order("full_name");
return data||[];
}

async function addPlayer(name){
await client().from("nsk_players").insert({full_name:name});
}

async function listPools(){
const {data}=await client().from("nsk_pools").select("*").order("pool_date");
return data||[];
}

async function addPool(p){
await client().from("nsk_pools").insert(p);
}

return{listPlayers,addPlayer,listPools,addPool};
})();