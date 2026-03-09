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
    const { data } = await c.auth.getUser();
    return data?.user || null;
  }

  return {
    init,
    getClient,
    getUser
  };

})();