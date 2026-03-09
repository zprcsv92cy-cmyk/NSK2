// auth.js — NSK Team 18 (safe init)

window.Auth = (function(){

  let client = null;

  function create(){
    if(client) return client;

    if(!window.supabase || !window.supabase.createClient){
      throw new Error("Supabase-biblioteket saknas.");
    }

    if(!window.APP_CONFIG){
      throw new Error("APP_CONFIG saknas.");
    }

    if(!APP_CONFIG.SUPABASE_URL || !APP_CONFIG.SUPABASE_KEY){
      throw new Error("APP_CONFIG saknar SUPABASE_URL eller SUPABASE_KEY.");
    }

    client = window.supabase.createClient(
      APP_CONFIG.SUPABASE_URL,
      APP_CONFIG.SUPABASE_KEY
    );

    return client;
  }

  async function init(){
    const c = create();
    await c.auth.getSession();
    return c;
  }

  function getClient(){
    return create();
  }

  async function login(email){

    const c = create();

    const redirect =
      window.location.origin +
      (APP_CONFIG.REDIRECT_PATH || "/NSK2/");

    const { error } = await c.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: redirect }
    });

    if(error) throw error;

    return true;
  }

  async function logout(){
    const c = create();
    await c.auth.signOut();
  }

  async function refreshSession(){
    const c = create();
    await c.auth.refreshSession();
  }

  return {
    init,
    getClient,
    login,
    logout,
    refreshSession
  };

})();