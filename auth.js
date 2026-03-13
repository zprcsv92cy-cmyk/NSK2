window.Auth = (() => {
  let supabase = null;
  let ready = false;
  let currentSession = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(message = "", isError = false) {
    const el = byId("authStatus");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("error", !!isError);
  }

  function showApp() {
    byId("loginView")?.classList.remove("active");
    byId("appView")?.classList.add("active");
    setStatus("");
  }

  function showLogin() {
    byId("appView")?.classList.remove("active");
    byId("loginView")?.classList.add("active");
    setStatus("");
  }

  function ensureConfig() {
    const url = window.APP_CONFIG?.SUPABASE_URL;
    const key = window.APP_CONFIG?.SUPABASE_KEY;

    if (!url || !key) {
      throw new Error("Supabase-konfiguration saknas i config.js.");
    }

    if (!window.supabase?.createClient) {
      throw new Error("Supabase-biblioteket saknas. Ladda supabase-js före auth.js.");
    }

    return { url, key };
  }

  function bindUi() {
    const loginBtn = byId("loginBtn");
    const logoutBtn = byId("logoutBtn");
    const mailInput = byId("emailInput");

    if (loginBtn && !loginBtn.dataset.bound) {
      loginBtn.dataset.bound = "1";
      loginBtn.addEventListener("click", async () => {
        try {
          const email = String(mailInput?.value || "").trim();
          if (!email) {
            setStatus("Fyll i e-postadress.", true);
            return;
          }

          setStatus("Skickar inloggningslänk...");

          const redirectTo = window.location.origin + window.location.pathname;

          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: redirectTo }
          });

          if (error) throw error;

          setStatus("Kolla din e-post för inloggningslänken.");
        } catch (err) {
          setStatus(err.message || String(err), true);
        }
      });
    }

    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = "1";
      logoutBtn.addEventListener("click", async () => {
        try {
          await supabase.auth.signOut();
          currentSession = null;
          showLogin();
        } catch (err) {
          setStatus(err.message || String(err), true);
        }
      });
    }
  }

  async function applySession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    currentSession = data?.session || null;

    if (currentSession) {
      showApp();
    } else {
      showLogin();
    }
  }

  async function init() {
    if (ready) return supabase;

    const { url, key } = ensureConfig();

    supabase = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    bindUi();

    await applySession();

    supabase.auth.onAuthStateChange((_event, session) => {
      currentSession = session || null;
      if (currentSession) showApp();
      else showLogin();
    });

    ready = true;
    return supabase;
  }

  function getClient() {
    return supabase;
  }

  function getSession() {
    return currentSession;
  }

  return {
    init,
    getClient,
    getSession
  };
})();