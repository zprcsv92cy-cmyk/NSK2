window.Auth = (() => {
  let supabase = null;
  let ready = false;
  let currentSession = null;

  const ADMIN_EMAIL = "peter_hasselberg@hotmail.com";
  const ROOT_PATHS = ["/NSK2/", "/NSK2/index.html"];

  function byId(id) {
    return document.getElementById(id);
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function setStatus(message = "", isError = false) {
    const el = byId("authStatus") || byId("loginMsg") || byId("appError");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("error", !!isError);
  }

  function isRootLoginPage() {
    return ROOT_PATHS.includes(window.location.pathname);
  }

  function hasLoginUi() {
    return !!byId("loginView");
  }

  function goToStartPage() {
    window.location.href = "https://zprcsv92cy-cmyk.github.io/NSK2/startsida/";
  }

  function showLogin() {
    const loginView = byId("loginView");
    const appView = byId("appView");
    if (appView) appView.style.display = "none";
    if (loginView) loginView.style.display = "flex";
  }

  function showApp() {
    if (isRootLoginPage()) {
      goToStartPage();
      return;
    }
    const loginView = byId("loginView");
    const appView = byId("appView");
    if (loginView) loginView.style.display = "none";
    if (appView) appView.style.display = "block";
  }

  function ensureConfig() {
    const url = window.APP_CONFIG?.SUPABASE_URL;
    const key = window.APP_CONFIG?.SUPABASE_KEY;

    if (!url || !key) throw new Error("Supabase config saknas");
    if (!window.supabase?.createClient) throw new Error("Supabase-biblioteket saknas");

    return { url, key };
  }

  async function ensureClient() {
    if (supabase) return supabase;
    const { url, key } = ensureConfig();
    supabase = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return supabase;
  }

  async function login(email, password) {
    const client = await ensureClient();

    const safeEmail = normalizeEmail(email);
    const safePassword = String(password || "");

    if (!safeEmail || !safePassword) {
      setStatus("Fyll i email och lösenord", true);
      return;
    }

    setStatus("Loggar in...");

    const { data, error } = await client.auth.signInWithPassword({
      email: safeEmail,
      password: safePassword
    });

    if (error) {
      setStatus(error.message || "Login misslyckades", true);
      return;
    }

    currentSession = data?.session || null;

    if (normalizeEmail(currentSession?.user?.email) !== normalizeEmail(ADMIN_EMAIL)) {
      await client.auth.signOut();
      currentSession = null;
      setStatus("Ej behörig användare", true);
      return;
    }

    setStatus("Inloggad");
    setTimeout(goToStartPage, 80);
  }

  async function logout() {
    const client = await ensureClient();
    await client.auth.signOut();
    currentSession = null;
    window.location.href = "https://zprcsv92cy-cmyk.github.io/NSK2/";
  }

  async function checkSession() {
    const client = await ensureClient();
    const { data, error } = await client.auth.getSession();

    if (error) {
      setStatus(error.message || "Kunde inte läsa session", true);
      return;
    }

    currentSession = data?.session || null;

    if (!currentSession) {
      if (isRootLoginPage() && hasLoginUi()) showLogin();
      return;
    }

    if (normalizeEmail(currentSession?.user?.email) !== normalizeEmail(ADMIN_EMAIL)) {
      await client.auth.signOut();
      currentSession = null;
      if (isRootLoginPage() && hasLoginUi()) {
        setStatus("Ej behörig användare", true);
        showLogin();
      }
      return;
    }

    if (isRootLoginPage()) showApp();
  }

  function bindUi() {
    const loginBtn = byId("loginBtn");
    const emailInput = byId("emailInput");
    const passwordInput = byId("passwordInput");
    const refreshBtn = byId("refreshBtn");

    if (loginBtn && !loginBtn.dataset.boundAuth) {
      loginBtn.dataset.boundAuth = "1";
      loginBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await login(emailInput?.value, passwordInput?.value);
      });
    }

    if (passwordInput && !passwordInput.dataset.boundAuth) {
      passwordInput.dataset.boundAuth = "1";
      passwordInput.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        await login(emailInput?.value, passwordInput?.value);
      });
    }

    if (refreshBtn && !refreshBtn.dataset.boundAuth) {
      refreshBtn.dataset.boundAuth = "1";
      refreshBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await checkSession();
      });
    }
  }

  async function init() {
    if (ready) return supabase;
    await ensureClient();
    bindUi();
    await checkSession();
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
