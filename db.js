
window.DB = (()=>{

const LOCAL="nsk_v7"

function load(){
try{
return JSON.parse(localStorage.getItem(LOCAL))||{pool:null}
}catch{
return {pool:null}
}
}

function save(data){
localStorage.setItem(LOCAL,JSON.stringify(data))
}

async function sync(pool){

const client=Auth.getClient()

const {error}=await client
.from("pools")
.upsert({
cloud_id:pool.cloud_id,
payload:pool
},{onConflict:"cloud_id"})

if(error)throw error

}

async function pull(cloud_id){

const client=Auth.getClient()

const {data,error}=await client
.from("pools")
.select("payload")
.eq("cloud_id",cloud_id)
.single()

if(error)throw error

return data.payload
}

function subscribe(cloud_id,callback){

const client=Auth.getClient()

client.channel("pools")
.on("postgres_changes",
{{event:"UPDATE",schema:"public",table:"pools",filter:"cloud_id=eq."+cloud_id}},
payload=>callback(payload.new.payload)
)
.subscribe()

}

return{{load,save,sync,pull,subscribe}}

})()
