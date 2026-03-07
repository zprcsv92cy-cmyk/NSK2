window.Auth = (() => {
  const SUPABASE_URL = "https://tonbbmxzotsjwuimobkn.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvbmJibXh6b3Rzand1aW1vYmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODExMTIsImV4cCI6MjA4ODI1NzExMn0.lYByBwAhjbxlSYpOcv8W3JboNkf8ldTiieQ4goMtopc";

  let client = null;
  let session = null;
  let role = "coach_full";
  let initPromise = null;

  function setMsg(text, ok=false) {
    const el = document.getElementById("loginMsg");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = ok ? "var(--ok)" : "";
  }

  function updateBadges() {
    const authBadge = document.getElementById("authBadge");
    const roleBadge = document.getElementById("roleBadge");
    if (authBadge) authBadge.textContent = session ? "Inloggad" : "Ej inloggad";
    if (roleBadge) roleBadge.textContent = "roll: " + (role || "—");
  }

  function showView(id) {
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === id));
  }

  async function ensureClient() {
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase-bibliotek kunde inte laddas.");
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return client;
  }

  async function init() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        await ensureClient();

        client.auth.onAuthStateChange(async (_event, nextSession) => {
          session = nextSession || null;
          updateBadges();
          if (session) {
            showView("appView");
            setMsg("");
            if (window.App && typeof window.App.onSignedIn === "function") {
              window.App.onSignedIn(session);
            }
          } else {
            showView("loginView");
          }
        });

        const { data } = await client.auth.getSession();
        session = data?.session || null;
        updateBadges();

        if (session) {
          showView("appView");
          if (window.App && typeof window.App.onSignedIn === "function") {
            window.App.onSignedIn(session);
          }
        } else {
          showView("loginView");
        }
      } catch (error) {
        setMsg(error.message || "Kunde inte initiera auth.");
        updateBadges();
      }
    })();

    return initPromise;
  }

  async function sendMagicLink(email) {
    if (!email) return setMsg("Skriv din e-post.");
    try {
      await init();
      await ensureClient();
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo }
      });
      if (error) return setMsg("Kunde inte skicka länk: " + error.message);
      setMsg("Länk skickad! Öppna mejlet och klicka på länken.", true);
    } catch (error) {
      setMsg(error.message || "Auth är inte initierad.");
    }
  }

  async function refreshSession() {
    try {
      await init();
      const { data } = await client.auth.getSession();
      session = data?.session || null;
      updateBadges();
      if (session) showView("appView");
    } catch (error) {
      setMsg(error.message || "Kunde inte uppdatera session.");
    }
  }

  async function logout() {
    try {
      await init();
      await client.auth.signOut();
      session = null;
      updateBadges();
      showView("loginView");
    } catch (error) {
      setMsg(error.message || "Kunde inte logga ut.");
    }
  }

  function getClient() { return client; }
  function getSession() { return session; }
  function getRole() { return role; }

  return { init, sendMagicLink, refreshSession, logout, getClient, getSession, getRole };
})();
