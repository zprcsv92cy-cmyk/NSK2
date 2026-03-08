window.Auth = (() => {
  let client = null;

  function getClient() {
    if (client) return client;

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase-biblioteket kunde inte laddas.");
    }

    if (!window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_KEY) {
      throw new Error("APP_CONFIG saknar SUPABASE_URL eller SUPABASE_KEY.");
    }

    client = window.supabase.createClient(
      window.APP_CONFIG.SUPABASE_URL,
      window.APP_CONFIG.SUPABASE_KEY
    );

    return client;
  }

  async function init() {
    const c = getClient();
    await c.auth.getSession();
    return c;
  }

  async function login(email) {
    const c = getClient();
    const clean = String(email || "").trim();
    if (!clean) throw new Error("Skriv en e-postadress.");

    const redirectTo =
      window.location.origin + (window.APP_CONFIG?.REDIRECT_PATH || "/NSK2/");

    const { error } = await c.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: redirectTo }
    });

    if (error) throw error;
    return true;
  }

  async function logout() {
    const c = getClient();
    const { error } = await c