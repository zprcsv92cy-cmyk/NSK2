
window.DB=(()=>{

const LOCAL="nsk_v63"

function load(){
try{
return JSON.parse(localStorage.getItem(LOCAL))||{pools:[]}
}catch{ return {pools:[]} }
}

function save(data){
localStorage.setItem(LOCAL,JSON.stringify(data))
}

function savePool(pool){
const d=load()
const i=d.pools.findIndex(p=>p.id===pool.id)
if(i>=0)d.pools[i]=pool
else d.pools.push(pool)
save(d)
}

async function syncPool(pool){

const client=Auth.getClient()
const session=Auth.getSession()
if(!client||!session)throw "not logged in"

const {error}=await client
.from("pools")
.upsert({
cloud_id:pool.cloud_id,
owner:session.user.email,
payload:pool
},{onConflict:"cloud_id"})

if(error)throw error
}

async function pullPool(cloud_id){

const client=Auth.getClient()

const {data,error}=await client
.from("pools")
.select("payload")
.eq("cloud_id",cloud_id)
.single()

if(error)throw error

return data.payload
}

return{{load,save,savePool,syncPool,pullPool}}

})()
