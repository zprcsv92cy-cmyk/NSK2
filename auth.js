window.Auth = (() => {
  const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
  const SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY";

  let client = null;
  let session = null;
  let role = "coach_full";

  function hasConfig() {
    return !SUPABASE_URL.includes("YOUR_PROJECT") && !SUPABASE_ANON_KEY.includes("YOUR_PUBLIC");
  }

  function setMsg(text, ok=false) {
    const el = document.getElementById("loginMsg");
    if (el) {
      el.textContent = text || "";
      el.style.color = ok ? "var(--ok)" : "";
    }
  }

  function updateBadges() {
    const authBadge = document.getElementById("authBadge");
    const roleBadge = document.getElementById("roleBadge");
    if (authBadge) authBadge.textContent = session ? "Inloggad" : "Ej inloggad";
    if (roleBadge) roleBadge.textContent = "roll: " + (role || "—");
  }

  function showView(id) {
    document.querySelectorAll(".view").forEach(v => {
      v.classList.toggle("active", v.id === id);
    });
  }

  async function init() {
    if (!window.supabase || !window.supabase.createClient) {
      setMsg("Supabase-bibliotek kunde inte laddas.");
      updateBadges();
      return;
    }

    if (!hasConfig()) {
      setMsg("Lägg in SUPABASE_URL och SUPABASE_ANON_KEY i auth.js.");
      updateBadges();
      showView("loginView");
      return;
    }

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  }

  async function sendMagicLink(email) {
    if (!client) return setMsg("Auth är inte initierad ännu.");
    if (!email) return setMsg("Skriv din e-post.");
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) return setMsg("Kunde inte skicka länk: " + error.message);
    setMsg("Länk skickad! Öppna mejlet och klicka på länken.", true);
  }

  async function refreshSession() {
    if (!client) return;
    const { data } = await client.auth.getSession();
    session = data?.session || null;
    updateBadges();
    if (session) showView("appView");
  }

  async function logout() {
    if (!client) return;
    await client.auth.signOut();
    session = null;
    updateBadges();
    showView("loginView");
  }

  function getClient() { return client; }
  function getSession() { return session; }
  function getRole() { return role; }

  return { init, sendMagicLink, refreshSession, logout, getClient, getSession, getRole };
})();
