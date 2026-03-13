window.Auth = (() => {
  let supabase = null;
  let ready = false;
  let currentSession = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(message = "", isError = false) {
    const el = byId("authStatus") || byId("loginMsg") || byId("appError");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("error", !!isError);
  }

  function isRootLoginPage() {
    return (
      location.pathname === "/NSK2/" ||
      location.pathname === "/NSK2/index.html"
    );
  }

  function showApp() {
    if (isRootLoginPage()) {
      window.location.href = "./startsida/";
      return;
    }

    const loginView = byId("loginView");
    const appView = byId("appView");

    if (loginView) loginView.classList.remove("active");
    if (appView) appView.classList.add("active");
  }

  function showLogin() {
    const appView = byId("appView");
    const loginView = byId("loginView");

    if (appView) appView.classList.remove("active");
    if (loginView) loginView.classList.add("active");
  }

  function ensureConfig() {
    const url = window.APP_CONFIG?.SUPABASE_URL;
    const key = window.APP_CONFIG?.SUPABASE_KEY;

    if (!url || !key) {
      throw new Error("Supabase-konfiguration saknas i config.js.");
    }

    if (!window.supabase?.createClient) {
      throw new Error("Supabase-biblioteket saknas.");
    }

    return { url, key };
  }

  async function login(email) {
    if (!supabase) await init();

    const safeEmail = String(email || "").trim();
    if (!safeEmail) {
      setStatus("Fyll i e-postadress.", true);
      return;
    }

    setStatus("Skickar inloggningslänk...");

    const redirectTo = "https://zprcsv92cy-cmyk.github.io/NSK2/";

    const { error } = await supabase.auth.signInWithOtp({
      email: safeEmail,
      options: {
        emailRedirectTo: redirectTo
      }
    });

    if (error) throw error;

    setStatus("Kolla din e-post för inloggningslänken.");
  }

  async function logout() {
    if (!supabase) await init();

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    currentSession = null;

    if (!isRootLoginPage()) {
      window.location.href = "../";
      return;
    }

    showLogin();
  }

  function bindUi() {
    const loginBtn = byId("loginBtn");
    const refreshBtn = byId("refreshBtn");
    const logoutBtn = byId("logoutBtn");
    const mailInput = byId("emailInput");

    if (loginBtn && !loginBtn.dataset.boundAuth) {
      loginBtn.dataset.boundAuth = "1";
      loginBtn.addEventListener("click", async () => {
        try {
          await login(mailInput?.value || "");
        } catch (err) {
          setStatus(err.message || String(err), true);
          console.error(err);
        }
      });
    }

    if (mailInput && !mailInput.dataset.boundAuth) {
      mailInput.dataset.boundAuth = "1";
      mailInput.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        try {
          await login(mailInput?.value || "");
        } catch (err) {
          setStatus(err.message || String(err), true);
          console.error(err);
        }
      });
    }

    if (refreshBtn && !refreshBtn.dataset.boundAuth) {
      refreshBtn.dataset.boundAuth = "1";
      refreshBtn.addEventListener("click", async () => {
        try {
          await applySession();
          setStatus("Session uppdaterad.");
        } catch (err) {
          setStatus(err.message || String(err), true);
          console.error(err);
        }
      });
    }

    if (logoutBtn && !logoutBtn.dataset.boundAuth) {
      logoutBtn.dataset.boundAuth = "1";
      logoutBtn.addEventListener("click", async () => {
        try {
          await logout();
        } catch (err) {
          setStatus(err.message || String(err), true);
          console.error(err);
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
    } else if (isRootLoginPage()) {
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
      else if (isRootLoginPage()) showLogin();
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
    login,
    logout,
    getClient,
    getSession
  };
})();