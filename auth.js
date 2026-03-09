window.Auth = (function(){
  let client = null;

  function create(){
    if(client) return client;

    if(!window.supabase || !window.supabase.createClient){
      throw new Error("Supabase-biblioteket saknas.");
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

  return { init, getClient };
})();
