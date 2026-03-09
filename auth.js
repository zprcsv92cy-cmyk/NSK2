window.Auth = (function(){
  let client = null;

  function create(){
    if(client) return client;

    if(!window.supabase || !window.supabase.createClient){
      throw new Error("Supabase-biblioteket saknas.");
    }

    if(!window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_KEY){
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
    const { error } = await c.auth.getSession();
    if(error) throw error;
    return c;
  }

  function getClient(){
    return create();
  }

  async function getDebugInfo(){
    const out = {
      hasSupabaseLib: !!(window.supabase && window.supabase.createClient),
      hasConfig: !!window.APP_CONFIG,
      hasUrl: !!window.APP_CONFIG?.SUPABASE_URL,
      hasKey: !!window.APP_CONFIG?.SUPABASE_KEY,
      projectUrl: window.APP_CONFIG?.SUPABASE_URL || "",
      sessionUser: null,
      authError: null
    };

    try{
      const c = create();
      const { data, error } = await c.auth.getUser();
      if(error) out.authError = error.message || String(error);
      out.sessionUser = data?.user?.email || null;
    }catch(err){
      out.authError = err.message || String(err);
    }

    return out;
  }

  return { init, getClient, getDebugInfo };
})();
