
window.Auth = (()=>{

const url="https://tonbbmxzotsjwuimobkn.supabase.co"
const key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvbmJibXh6b3Rzand1aW1vYmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODExMTIsImV4cCI6MjA4ODI1NzExMn0.lYByBwAhjbxlSYpOcv8W3JboNkf8ldTiieQ4goMtopc"

let client=null
let session=null

async function init(){
client=supabase.createClient(url,key)

const {data}=await client.auth.getSession()
session=data.session

if(session) showApp()

client.auth.onAuthStateChange((_e,s)=>{
session=s
if(session) showApp()
})
}

function showApp(){
document.getElementById("loginView").classList.remove("active")
document.getElementById("appView").classList.add("active")
document.getElementById("authBadge").textContent="Inloggad"
}

async function login(email){
await client.auth.signInWithOtp({
email,
options:{emailRedirectTo:location.href}
})
document.getElementById("loginMsg").textContent="Mail skickat"
}

function getClient(){return client}
function getSession(){return session}

return {init,login,getClient,getSession}

})()
