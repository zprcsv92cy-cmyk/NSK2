window.Auth = (() => {
  let supabase = null;
  let ready = false;
  let currentSession = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(message = "", isError = false) {
    const el = byId("authStatus") || byId("loginMsg");
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

    setStatus("");
  }

  function showLogin() {
    const appView = byId("appView");
    const loginView = byId("loginView");

    if (appView) appView.classList.remove("active");
    if (loginView) loginView.classList.add("active");

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

  async function login(email) {
    if (!supabase) {
      await init();
    }

    const safeEmail = String(email || "").trim();
    if (!safeEmail) {
      setStatus("Fyll i e-postadress.", true);
      return;
    }

    setStatus("Skickar inloggningslänk...");

    const redirectTo = window.location.origin + "/NSK2/";

    const { error } = await supabase.auth.signInWithOtp({
      email: safeEmail,
      options: { emailRedirectTo: redirectTo }
    });

    if (error) throw error;

    setStatus("Kolla din e-post för inloggningslänken.");
  }

  async function logout() {
    if (!supabase) {
      await init();
    }

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

    if (loginBtn && !loginBtn.dataset.bound) {
      loginBtn.dataset.bound = "1";
      loginBtn.addEventListener("click", async () => {
        try {
          await login(mailInput?.value || "");
        } catch (err) {
          setStatus(err.message || String(err), true);
        }
      });
    }

    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = "1";
      refreshBtn.addEventListener("click", async () => {
        try {
          await applySession();
          setStatus("Session uppdaterad.");
        } catch (err) {
          setStatus(err.message || String(err), true);
        }
      });
    }

    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = "1";
      logoutBtn.addEventListener("click", async () => {
        try {
          await logout();
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
      if (isRootLoginPage()) {
        showLogin();
      }
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

      if (currentSession) {
        showApp();
      } else if (isRootLoginPage()) {
        showLogin();
      }
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

async function login(email) {
  if (!supabase) await init();

  const redirectTo = window.location.origin + "/NSK2/";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo
    }
  });

  if (error) throw error;
}

  return {
  init,
  login,
  getClient,
  getSession
};