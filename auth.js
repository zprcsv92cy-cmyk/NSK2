if(!window.APP_CONFIG){
  throw new Error("APP_CONFIG saknas. Kontrollera att config.js laddas före auth.js.");
}

window.Auth = (()=>{
const SUPABASE_URL = window.APP_CONFIG.SUPABASE_URL;
const SUPABASE_KEY = window.APP_CONFIG.SUPABASE_KEY;
let client=null, session=null, initPromise=null;

function msg(text,color=""){
  const el=document.getElementById("loginMsg");
  if(el){el.textContent=text||"";el.style.color=color;}
}
function setStatus(){
  const el=document.getElementById("authStatus");
  if(el) el.textContent=session?"Inloggad":"Ej inloggad";
}
function showApp(){
  document.getElementById("loginView")?.classList.remove("active");
  document.getElementById("appView")?.classList.add("active");
  setStatus();
}
function showLogin(){
  document.getElementById("appView")?.classList.remove("active");
  document.getElementById("loginView")?.classList.add("active");
  setStatus();
}
async function ensure(){
  if(client) return client;
  client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  return client;
}
async function init(){
  if(initPromise) return initPromise;
  initPromise=(async()=>{
    try{
      await ensure();
      client.auth.onAuthStateChange((_e,s)=>{
        session=s||null;
        session?showApp():showLogin();
      });
      const {data,error}=await client.auth.getSession();
      if(error) throw error;
      session=data?.session||null;
      session?showApp():showLogin();
    }catch(e){
      msg(e.message||String(e),"#ff6b6b");
      showLogin();
    }
  })();
  return initPromise;
}
async function login(email){
  try{
    if(!String(email||"").trim()) return msg("Skriv e-post.","#ff6b6b");
    await init();
    const redirectTo=window.location.origin+window.location.pathname;
    const {error}=await client.auth.signInWithOtp({
      email:String(email).trim(),
      options:{emailRedirectTo:redirectTo}
    });
    if(error) throw error;
    msg("Magic link skickad. Kolla inkorg och skräppost.","#35d07f");
  }catch(e){
    msg(e.message||String(e),"#ff6b6b");
  }
}
async function refresh(){
  await init();
  const {data}=await client.auth.getSession();
  session=data?.session||null;
  session?showApp():showLogin();
}
function getClient(){return client}
function getSession(){return session}
return {init,login,refresh,getClient,getSession}
})();
