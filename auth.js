window.Auth = (() => {
  let supabase = null;
  let ready = false;
  let currentSession = null;

  const adminEmail = "peter_hasselberg@hotmail.com";

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(msg = "", err = false) {
    const el = byId("authStatus") || byId("loginMsg") || byId("appError");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("error", err);
  }

  function ensureConfig() {
    const url = window.APP_CONFIG?.SUPABASE_URL;
    const key = window.APP_CONFIG?.SUPABASE_KEY;

    if (!url || !key) {
      throw new Error("Supabase config saknas");
    }

    return { url, key };
  }

  function goToStartPage() {
    window.location.href = "https://zprcsv92cy-cmyk.github.io/NSK2/startsida/";
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  async function login(email, password) {
    if (!supabase) await init();

    const safeEmail = normalizeEmail(email);
    const safePassword = String(password || "");

    if (!safeEmail || !safePassword) {
      setStatus("Fyll i email och lösenord", true);
      return;
    }

    setStatus("Loggar in...");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: safeEmail,
      password: safePassword
    });

    if (error) {
      setStatus(error.message || "Login misslyckades", true);
      return;
    }

    currentSession = data?.session || null;

    const signedInEmail = normalizeEmail(currentSession?.user?.email);
    const allowedEmail = normalizeEmail(adminEmail);

    if (signedInEmail !== allowedEmail) {
      await supabase.auth.signOut();
      currentSession = null;
      setStatus("Ej behörig användare", true);
      return;
    }

    setStatus("Inloggad");

    setTimeout(() => {
      goToStartPage();
    }, 100);
  }

  async function logout() {
    if (!supabase) await init();

    await supabase.auth.signOut();
    currentSession = null;
    window.location.href = "https://zprcsv92cy-cmyk.github.io/NSK2/";
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

  async function checkSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      setStatus(error.message || "Kunde inte läsa session", true);
      return;
    }

    currentSession = data?.session || null;

    if (currentSession) {
      const signedInEmail = normalizeEmail(currentSession?.user?.email);
      const allowedEmail = normalizeEmail(adminEmail);

      if (signedInEmail !== allowedEmail) {
        await supabase.auth.signOut();
        currentSession = null;
        setStatus("Ej behörig användare", true);
        return;
      }

      goToStartPage();
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
    await checkSession();

    ready = true;
    return supabase;
  }

  return {
    init,
    login,
    logout
  };
})();