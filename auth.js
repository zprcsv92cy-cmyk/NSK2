window.Auth = (() => {
  const SUPABASE_URL = "https://tonbbmxzotsjwuimobkn.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInJlZiI6InRvbmJibXh6b3Rzand1aW1vYmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODExMTIsImV4cCI6MjA4ODI1NzExMn0.lYByBwAhjbxlSYpOcv8W3JboNkf8ldTiieQ4goMtopc";

  let client = null;
  let session = null;
  let initPromise = null;

  function setMsg(text, kind = "") {
    const el = document.getElementById("loginMsg");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = kind === "ok" ? "var(--ok, #35d07f)" : (kind === "err" ? "#ff6b6b" : "");
  }

  function setStatus() {
    const auth = document.getElementById("authStatus") || document.getElementById("authBadge");
    if (auth) auth.textContent = session ? "Inloggad" : "Ej inloggad";
  }

  function showApp() {
    const loginView = document.getElementById("loginView");
    const appView = document.getElementById("appView");
    if (loginView) {
      loginView.style.display = "none";
      loginView.classList.remove("active");
    }
    if (appView) {
      appView.style.display = "block";
      appView.classList.add("active");
    }
    setStatus();
  }

  function showLogin() {
    const loginView = document.getElementById("loginView");
    const appView = document.getElementById("appView");
    if (appView) {
      appView.style.display = "none";
      appView.classList.remove("active");
    }
    if (loginView) {
      loginView.style.display = "block";
      loginView.classList.add("active");
    }
    setStatus();
  }

  async function ensureClient() {
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase-biblioteket kunde inte laddas.");
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return client;
  }

  function prettyError(error) {
    const msg = String(error?.message || error || "");
    if (/email address/i.test(msg) || /invalid email/i.test(msg)) return "E-postadressen verkar ogiltig.";
    if (/rate limit/i.test(msg) || /security purposes/i.test(msg) || /too many/i.test(msg)) return "För många försök. Vänta en stund och prova igen.";
    if (/smtp/i.test(msg)) return "Supabase kunde inte skicka mejlet. Kontrollera e-postinställningar i Supabase.";
    if (/redirect/i.test(msg) || /site url/i.test(msg)) return "Redirect-URL i Supabase verkar vara fel.";
    return msg || "Okänt fel vid inloggning.";
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        await ensureClient();

        client.auth.onAuthStateChange(async (_event, nextSession) => {
          session = nextSession || null;
          if (session) {
            setMsg("Inloggning lyckades.", "ok");
            showApp();
          } else {
            showLogin();
          }
        });

        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        session = data?.session || null;

        if (session) showApp();
        else showLogin();
      } catch (error) {
        setMsg(prettyError(error), "err");
        showLogin();
      }
    })();
    return initPromise;
  }

  async function login(email) {
    try {
      if (!email || !String(email).trim()) {
        setMsg("Skriv en e-postadress.", "err");
        return;
      }

      await init();
      await ensureClient();

      const cleanEmail = String(email).trim();
      const redirectTo = window.location.origin + window.location.pathname;

      setMsg("Skickar magic link...");

      const { data, error } = await client.auth.signInWithOtp({
        email: cleanEmail,
        options: { emailRedirectTo: redirectTo }
      });

      if (error) throw error;

      const sent = data?.user?.email || cleanEmail;
      setMsg("Magic link skickad till " + sent + ". Kolla inkorg och skräppost.", "ok");
    } catch (error) {
      setMsg(prettyError(error), "err");
      try { console.error("Magic link error:", error); } catch {}
    }
  }

  async function refreshSession() {
    try {
      await init();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      session = data?.session || null;
      if (session) {
        setMsg("Session hittad.", "ok");
        showApp();
      } else {
        setMsg("Ingen aktiv session ännu.", "err");
        showLogin();
      }
    } catch (error) {
      setMsg(prettyError(error), "err");
    }
  }

  async function logout() {
    try {
      await init();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      session = null;
      setMsg("Utloggad.", "ok");
      showLogin();
    } catch (error) {
      setMsg(prettyError(error), "err");
    }
  }

  function getClient() { return client; }
  function getSession() { return session; }

  return { init, login, refreshSession, logout, getClient, getSession };
})();
