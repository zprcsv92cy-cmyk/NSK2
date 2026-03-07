
window.App = (()=>{

let state={
pool:{id:"",cloud_id:"",name:"",matches:[]},
timer:0,
interval:null
}

function uid(){return Math.random().toString(36).slice(2)}

function el(id){return document.getElementById(id)}

function save(){

state.pool.name=el("poolName").value
state.pool.cloud_id=el("cloudId").value||("pool_"+uid())
state.pool.id=state.pool.id||uid()

DB.save({pool:state.pool})

el("cloudId").value=state.pool.cloud_id
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

const d=document.createElement("div")
d.textContent=m.title
wrap.appendChild(d)

})

updateCoach()

}

function updateCoach(){

const m=state.pool.matches

el("current").textContent=m[0]?m[0].title:"—"
el("next").textContent=m[1]?m[1].title:"—"

}

function startTimer(){

if(state.interval)return

state.interval=setInterval(()=>{
state.timer++
el("timer").textContent=format(state.timer)
},1000)

}

function resetTimer(){

clearInterval(state.interval)
state.interval=null
state.timer=0
el("timer").textContent="00:00"

}

function format(s){

const m=Math.floor(s/60).toString().padStart(2,"0")
const ss=(s%60).toString().padStart(2,"0")

return m+":"+ss

}

async function sync(){

await DB.sync(state.pool)

}

async function pull(){

const id=el("cloudId").value
const pool=await DB.pull(id)

state.pool=pool
render()

DB.subscribe(id,(p)=>{
state.pool=p
render()
})

}

function bind(){

el("loginBtn").onclick=()=>Auth.login(el("email").value)

el("savePool").onclick=save
el("addMatch").onclick=addMatch
el("syncPool").onclick=sync
el("pullPool").onclick=pull

el("startTimer").onclick=startTimer
el("resetTimer").onclick=resetTimer

}

function init(){

bind()
Auth.init()

}

return{{init}}

})()

window.onload=App.init
