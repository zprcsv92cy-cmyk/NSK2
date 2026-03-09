window.Auth = (function(){
  let client = null;

  function createClient(){
    if(client) return client;

    if(!window.supabase || !window.supabase.createClient){
      throw new Error("Supabase library saknas");
    }

    if(!window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_KEY){
      throw new Error("APP_CONFIG saknar SUPABASE_URL eller SUPABASE_KEY");
    }

    client = window.supabase.createClient(
      window.APP_CONFIG.SUPABASE_URL,
      window.APP_CONFIG.SUPABASE_KEY
    );

    return client;
  }

  async function init(){
    const c = createClient();
    await c.auth.getSession();
    return c;
  }

  function getClient(){
    return createClient();
  }

  async function getUser(){
    const c = createClient();
    const { data, error } = await c.auth.getUser();
    if(error) throw error;
    return data?.user || null;
  }

  async function login(email){
    const c = createClient();
    const clean = String(email || "").trim();
    if(!clean) throw new Error("Skriv en e-postadress.");

    const redirectTo =
      window.location.origin + (window.APP_CONFIG?.REDIRECT_PATH || "/NSK2/");

    const { error } = await c.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: redirectTo }
    });

    if(error) throw error;
    return true;
  }

  async function logout(){
    const c = createClient();
    const { error } = await c.auth.signOut();
    if(error) throw error;
    return true;
  }

  async function refreshSession(){
    const c = createClient();
    const { error } = await c.auth.refreshSession();
    if(error) throw error;
    return true;
  }

  return {
    init,
    getClient,
    getUser,
    login,
    logout,
    refreshSession
  };
})();
