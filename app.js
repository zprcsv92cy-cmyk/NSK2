
window.App=(()=>{

let state={pool:{id:"",cloud_id:"",name:"",matches:[]}}

function uid(){return Math.random().toString(36).slice(2)}

function el(id){return document.getElementById(id)}

function savePool(){

state.pool.name=el("poolName").value
state.pool.cloud_id=el("poolCloudId").value||("pool_"+uid())
state.pool.id=state.pool.id||uid()

DB.savePool(state.pool)

el("poolCloudId").value=state.pool.cloud_id
}

function addMatch(){

state.pool.matches.push({
id:uid(),
title:"Match "+(state.pool.matches.length+1)
})

render()
}

function render(){

const wrap=el("matches")
wrap.innerHTML=""

state.pool.matches.forEach(m=>{
const div=document.createElement("div")
div.textContent=m.title
wrap.appendChild(div)
})
}

async function sync(){

try{
await DB.syncPool(state.pool)
document.getElementById("syncBadge").textContent="synkad"
}catch(e){
alert(e)
}
}

async function pull(){

const id=el("poolCloudId").value
const pool=await DB.pullPool(id)

state.pool=pool
render()
}

function bind(){

el("btnSavePool").onclick=savePool
el("btnAddMatch").onclick=addMatch
el("btnSync").onclick=sync
el("btnPull").onclick=pull

el("btnSendLink").onclick=()=>Auth.login(el("loginEmail").value)

}

function init(){
bind()
Auth.init()
}

return{{init}}

})()

window.onload=App.init
