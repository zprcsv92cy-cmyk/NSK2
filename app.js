window.NSK2App=(()=>{

function byId(id){return document.getElementById(id);}

async function loadPlayers(){
 if(!byId("playersList"))return;
 const players=await DB.listPlayers();
 byId("playersList").innerHTML=players.map(p=>"<div>"+p.full_name+"</div>").join("");
}

async function addPlayer(){
 const name=byId("playerInput").value.trim();
 if(!name)return;
 await DB.addPlayer(name);
 byId("playerInput").value="";
 loadPlayers();
}

async function loadPools(){
 if(!byId("savedPoolsList"))return;
 const pools=await DB.listPools();
 byId("savedPoolsList").innerHTML=pools.map(p=>"<div>"+p.title+"</div>").join("");
}

async function addPool(){
 const title=byId("poolName").value;
 const place=byId("poolPlace").value;
 const date=byId("poolDate").value;
 await DB.addPool({title,place,pool_date:date});
 loadPools();
}

function init(){
 if(byId("addPlayerBtn"))byId("addPlayerBtn").onclick=addPlayer;
 if(byId("savePoolBtn"))byId("savePoolBtn").onclick=addPool;
 loadPlayers();
 loadPools();
}

return{init};

})();

window.addEventListener("DOMContentLoaded",()=>NSK2App.init());