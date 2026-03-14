
/* NSK App v723
   Includes Next Match logic in Matchvy
*/

let matchCurrentShiftIndex = 0;

function byId(id){return document.getElementById(id)}
function setText(id,t){const e=byId(id);if(e)e.textContent=t||""}
function setHtml(id,h){const e=byId(id);if(e)e.innerHTML=h||""}

function esc(s){
  return String(s??"").replace(/[&<>"]/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
  }[m]))
}

function shortName(n){
  const p=String(n||"").trim().split(/\s+/)
  if(!p.length)return""
  if(p.length===1)return p[0]
  return p[0]+" "+p[p.length-1][0]+"."
}

/* ================= MATCHVY ================= */

async function updateNextMatchButton(poolId,lagNo,matchNo){
  const btn=byId("nextMatchBtn")
  if(!btn)return

  const pool=await DB.getPool(poolId)
  const maxMatches=parseInt(pool?.matches||"4",10)||4
  const currentMatch=parseInt(matchNo,10)||1

  const rows=await DB.listShiftSchema(poolId,lagNo,matchNo)
  const lastShift=rows.length>0 && matchCurrentShiftIndex>=rows.length-1
  const hasMore=currentMatch<maxMatches

  btn.style.display=(lastShift && hasMore)?"":"none"
}

async function renderCoachMatchView(poolId,lagNo,matchNo){

  const rows=await DB.listShiftSchema(poolId,lagNo,matchNo)
  const players=await DB.listPlayers()

  const map={}
  players.forEach(p=>map[String(p.id)]=p.full_name)

  if(!rows.length){
    setText("currentPlayers","—")
    setText("nextPlayers","—")
    return
  }

  if(matchCurrentShiftIndex<0)matchCurrentShiftIndex=0
  if(matchCurrentShiftIndex>rows.length-1)matchCurrentShiftIndex=rows.length-1

  const current=rows[matchCurrentShiftIndex]
  const next=rows[matchCurrentShiftIndex+1]

  const cur=(current?.players_json||[])
      .map(id=>shortName(map[String(id)]||"—")).join("<br>")

  const nxt=(next?.players_json||[])
      .map(id=>shortName(map[String(id)]||"—")).join("<br>")

  setHtml("currentPlayers",cur||"—")
  setHtml("nextPlayers",nxt||"—")

  setText("currentShiftMeta",
    "Pågående byte "+(matchCurrentShiftIndex+1)+" av "+rows.length)

  setText("nextShiftMeta",
    next?("Nästa byte "+(matchCurrentShiftIndex+2)):"Sista byte")

}

async function initMatchvyPage(){

  const current=byId("currentPlayers")
  const next=byId("nextPlayers")
  if(!current||!next)return

  const poolId=sessionStorage.getItem("nsk2_pool_id")
  const lagNo=sessionStorage.getItem("nsk2_lag_nr")||"1"
  let matchNo=sessionStorage.getItem("nsk2_match_no")||"1"

  if(!poolId)return

  matchCurrentShiftIndex=0

  await renderCoachMatchView(poolId,lagNo,matchNo)
  await updateNextMatchButton(poolId,lagNo,matchNo)

  const prevBtn=byId("prevShiftBtn")
  const nextBtn=byId("nextShiftBtn")
  const nextMatchBtn=byId("nextMatchBtn")

  if(prevBtn){
    prevBtn.onclick=async()=>{
      matchCurrentShiftIndex=Math.max(0,matchCurrentShiftIndex-1)
      await renderCoachMatchView(poolId,lagNo,matchNo)
      await updateNextMatchButton(poolId,lagNo,matchNo)
    }
  }

  if(nextBtn){
    nextBtn.onclick=async()=>{

      const rows=await DB.listShiftSchema(poolId,lagNo,matchNo)
      const currentShift=rows[matchCurrentShiftIndex]

      if(currentShift){
        await DB.setShiftDone(
          poolId,lagNo,matchNo,currentShift.shift_no,true
        )
      }

      if(matchCurrentShiftIndex<rows.length-1){
        matchCurrentShiftIndex++
      }

      await renderCoachMatchView(poolId,lagNo,matchNo)
      await updateNextMatchButton(poolId,lagNo,matchNo)
    }
  }

  if(nextMatchBtn){
    nextMatchBtn.onclick=async()=>{

      const pool=await DB.getPool(poolId)
      const maxMatches=parseInt(pool?.matches||"4",10)||4
      const currentMatch=parseInt(matchNo,10)||1

      if(currentMatch>=maxMatches)return

      matchNo=String(currentMatch+1)
      sessionStorage.setItem("nsk2_match_no",matchNo)

      matchCurrentShiftIndex=0

      await renderCoachMatchView(poolId,lagNo,matchNo)
      await updateNextMatchButton(poolId,lagNo,matchNo)
    }
  }

}

/* ================= INIT ================= */

window.addEventListener("DOMContentLoaded",async()=>{
  try{
    if(window.Auth?.init)await Auth.init()
    await initMatchvyPage()
  }catch(e){
    const el=byId("appError")
    if(el)el.textContent=e.message||String(e)
    console.error(e)
  }
})
