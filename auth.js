window.Auth = (() => {

let supabase = null;
let ready = false;
let currentSession = null;

const adminEmail = "peter_hasselberg@hotmail.com";

function byId(id){
  return document.getElementById(id);
}

function setStatus(msg="",err=false){
  const el = byId("authStatus") || byId("loginMsg") || byId("appError");
  if(!el) return;
  el.textContent = msg;
  el.classList.toggle("error",err);
}

function ensureConfig(){

  const url = window.APP_CONFIG?.SUPABASE_URL;
  const key = window.APP_CONFIG?.SUPABASE_KEY;

  if(!url || !key){
    throw new Error("Supabase config saknas");
  }

  return {url,key};
}

async function login(email,password){

  if(!supabase) await init();

  const safeEmail = String(email || "").trim();
  const safePassword = String(password || "");

  if(!safeEmail || !safePassword){
    setStatus("Fyll i email och lösenord",true);
    return;
  }

  setStatus("Loggar in...");

  const {data,error} =
  await supabase.auth.signInWithPassword({
    email:safeEmail,
    password:safePassword
  });

  if(error){
    setStatus(error.message,true);
    return;
  }

  currentSession = data.session;

  if(currentSession.user.email !== adminEmail){
    await supabase.auth.signOut();
    setStatus("Ej behörig användare",true);
    return;
  }

  setStatus("Inloggad");

  window.location.replace("./startsida/");
}

async function logout(){

  if(!supabase) await init();

  await supabase.auth.signOut();

  window.location.href="./";
}

function bindUi(){

  const loginBtn = byId("loginBtn");
  const emailInput = byId("emailInput");
  const passwordInput = byId("passwordInput");

  if(loginBtn){
    loginBtn.onclick = ()=>{
      login(
        emailInput?.value,
        passwordInput?.value
      );
    };
  }

  if(passwordInput){
    passwordInput.addEventListener("keydown",e=>{
      if(e.key==="Enter"){
        login(
          emailInput?.value,
          passwordInput?.value
        );
      }
    });
  }

}

async function checkSession(){

  const {data} = await supabase.auth.getSession();

  currentSession = data?.session;

  if(currentSession){

    if(currentSession.user.email !== adminEmail){
      await supabase.auth.signOut();
      return;
    }

    window.location.replace("./startsida/");
  }

}

async function init(){

  if(ready) return supabase;

  const {url,key} = ensureConfig();

  supabase = window.supabase.createClient(
    url,
    key,
    {
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true
      }
    }
  );

  bindUi();

  await checkSession();

  ready=true;

  return supabase;
}

return{
  init,
  login,
  logout
};

})();