
window.Auth = (()=>{

const client = supabase.createClient("https://tonbbmxzotsjwuimobkn.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvbmJibXh6b3Rzand1aW1vYmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODExMTIsImV4cCI6MjA4ODI1NzExMn0.lYByBwAhjbxlSYpOcv8W3JboNkf8ldTiieQ4goMtopc")
let session=null

async function init(){
const {data} = await client.auth.getSession()
session=data.session

if(session)showApp()

client.auth.onAuthStateChange((_e,s)=>{
session=s
if(session)showApp()
})
}

function showApp(){
document.getElementById("loginView").style.display="none"
document.getElementById("appView").style.display="block"
document.getElementById("authStatus").textContent="Inloggad"
}

async function login(email){
await client.auth.signInWithOtp({
email,
options:{emailRedirectTo:location.href}
})
}

function getClient(){return client}
function getSession(){return session}

return {init,login,getClient,getSession}

})()
