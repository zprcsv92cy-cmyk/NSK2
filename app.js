
const SUPABASE_URL="https://YOURPROJECT.supabase.co"
const SUPABASE_KEY="PUBLICANONKEY"

const supabase = window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY)

const emailInput=document.getElementById("email")
const status=document.getElementById("status")

document.getElementById("loginBtn").onclick=async()=>{
const email=emailInput.value
if(!email)return

const {error}=await supabase.auth.signInWithOtp({email})

status.innerText=error?error.message:"Länk skickad"
}

function exportPDF(){
window.print()
}

function backup(){
const data={date:new Date()}
const blob=new Blob([JSON.stringify(data,null,2)])
const a=document.createElement("a")
a.href=URL.createObjectURL(blob)
a.download="backup.json"
a.click()
}

supabase.auth.onAuthStateChange((event,session)=>{
if(session){
document.getElementById("loginView").classList.add("hidden")
document.getElementById("appView").classList.remove("hidden")
}
})
