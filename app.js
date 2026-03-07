window.App = (() => {
  let state = {
    pool: {
      id: "",
      name: "",
      date: "",
      place: "",
      teams: [],
      matches: []
    },
    coachIndex: 0
  };

  function uid() {
    return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setMsg(id, text, ok = false) {
    const el = byId(id);
    if (!el) return;
    el.textContent = text || "";
    el.style.color = ok ? "var(--ok)" : "";
  }

  function currentPoolFromForm() {
    const teams = String(byId("poolTeams").value || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    return {
      ...state.pool,
      name: String(byId("poolName").value || "").trim(),
      date: String(byId("poolDate").value || "").trim(),
      place: String(byId("poolPlace").value || "").trim(),
      teams
    };
  }

  function fillForm() {
    byId("poolName").value = state.pool.name || "";
    byId("poolDate").value = state.pool.date || "";
    byId("poolPlace").value = state.pool.place || "";
    byId("poolTeams").value = (state.pool.teams || []).join(", ");
  }

  function savePool() {
    const next = currentPoolFromForm();
    if (!next.name) return setMsg("poolMsg", "Skriv namn på poolspelet.");
    if (!next.date) return setMsg("poolMsg", "Välj datum.");
    next.id = next.id || uid();
    DB.savePool(next);
    state.pool = next;
    setMsg("poolMsg", "Poolspelet sparat.", true);
    renderMatches();
    renderCoach();
  }

  function addMatch() {
    const number = (state.pool.matches || []).length + 1;
    const match = {
      id: uid(),
      title: "Match " + number,
      time: "",
      opponent: "",
      field: "",
      done: false
    };
    state.pool.matches = [...(state.pool.matches || []), match];
    DB.savePool(state.pool);
    renderMatches();
    renderCoach();
  }

  function updateMatch(id, patch) {
    state.pool.matches = (state.pool.matches || []).map(m => m.id === id ? { ...m, ...patch } : m);
    DB.savePool(state.pool);
    renderMatches();
    renderCoach();
  }

  function renderMatches() {
    const wrap = byId("matchesList");
    if (!wrap) return;

    const matches = state.pool.matches || [];
    if (!matches.length) {
      wrap.innerHTML = '<div class="small">Inga matcher ännu.</div>';
      return;
    }

    wrap.innerHTML = matches.map((m, i) => `
      <div class="match-item">
        <div class="top">
          <div>
            <b>${escapeHtml(m.title || ("Match " + (i + 1)))}</b>
            <div class="small meta">${escapeHtml(state.pool.date || "—")} • ${escapeHtml(state.pool.place || "—")}</div>
          </div>
          <div class="status ${m.done ? "status-done" : "status-pending"}">${m.done ? "Klar" : "Pågår"}</div>
        </div>
        <div class="row mt8">
          <div>
            <label>Tid</label>
            <input data-id="${m.id}" data-field="time" value="${escapeAttr(m.time || "")}" placeholder="10:00">
          </div>
          <div>
            <label>Motståndare</label>
            <input data-id="${m.id}" data-field="opponent" value="${escapeAttr(m.opponent || "")}" placeholder="Motståndare">
          </div>
          <div>
            <label>Plan</label>
            <input data-id="${m.id}" data-field="field" value="${escapeAttr(m.field || "")}" placeholder="1">
          </div>
        </div>
        <div class="btnrow mt8">
          <button type="button" data-action="toggle" data-id="${m.id}" class="${m.done ? "ghost" : ""}">${m.done ? "Markera ej klar" : "Markera klar"}</button>
          <button type="button" data-action="delete" data-id="${m.id}" class="ghost">Ta bort</button>
        </div>
      </div>
    `).join("");
  }

  function renderCoach() {
    const matches = state.pool.matches || [];
    if (!matches.length) {
      byId("coachCurrent").textContent = "Ingen match vald";
      byId("coachNext").textContent = "—";
      return;
    }

    if (state.coachIndex < 0) state.coachIndex = 0;
    if (state.coachIndex > matches.length - 1) state.coachIndex = matches.length - 1;

    const cur = matches[state.coachIndex];
    const next = matches[state.coachIndex + 1];

    byId("coachCurrent").textContent = formatCoach(cur);
    byId("coachNext").textContent = next ? formatCoach(next) : "Ingen nästa match";
  }

  function formatCoach(match) {
    const parts = [
      match.title || "",
      match.time || "—",
      match.opponent ? "mot " + match.opponent : "mot —",
      match.field ? "plan " + match.field : "plan —"
    ].filter(Boolean);
    return parts.join(" • ");
  }

  function loadDemo() {
    state.pool = {
      id: uid(),
      name: "Demo poolspel",
      date: new Date().toISOString().slice(0, 10),
      place: "Nyköping",
      teams: ["Lag 1", "Lag 2"],
      matches: [
        { id: uid(), title: "Match 1", time: "09:00", opponent: "Oxelösund", field: "1", done: false },
        { id: uid(), title: "Match 2", time: "10:20", opponent: "Trosa", field: "2", done: false },
        { id: uid(), title: "Match 3", time: "11:40", opponent: "Gnesta", field: "1", done: false }
      ]
    };
    fillForm();
    DB.savePool(state.pool);
    renderMatches();
    renderCoach();
    setMsg("poolMsg", "Demo laddad.", true);
  }

  function exportJson() {
    const data = DB.load();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nsk-v5-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      DB.save(data);
      const firstPool = Array.isArray(data.pools) && data.pools.length ? data.pools[0] : null;
      if (firstPool) {
        state.pool = firstPool;
        fillForm();
        renderMatches();
        renderCoach();
      }
      setMsg("poolMsg", "Import klar.", true);
    } catch (e) {
      setMsg("poolMsg", "Import misslyckades: " + (e.message || e));
    }
  }

  function saveInviteLocal() {
    const email = String(byId("inviteEmail").value || "").trim();
    const role = String(byId("inviteRole").value || "coach_run");
    if (!email) return setMsg("adminMsg", "Skriv e-post.");
    DB.saveInvite({ email, role, savedAt: Date.now() });
    setMsg("adminMsg", "Inbjudan sparad lokalt.", true);
    byId("inviteEmail").value = "";
  }

  function printPdf() {
    window.print();
  }

  function onSignedIn() {
    const data = DB.load();
    const firstPool = data.pools && data.pools.length ? data.pools[0] : null;
    if (firstPool) {
      state.pool = firstPool;
    }
    fillForm();
    renderMatches();
    renderCoach();
  }

  function bindEvents() {
    byId("btnSendLink").addEventListener("click", () => {
      Auth.sendMagicLink(String(byId("loginEmail").value || "").trim());
    });

    byId("btnRefreshSession").addEventListener("click", () => Auth.refreshSession());
    byId("btnLogout").addEventListener("click", () => Auth.logout());
    byId("btnSavePool").addEventListener("click", savePool);
    byId("btnAddMatch").addEventListener("click", addMatch);
    byId("btnLoadDemo").addEventListener("click", loadDemo);
    byId("btnExportJson").addEventListener("click", exportJson);
    byId("btnPrint").addEventListener("click", printPdf);
    byId("btnSaveInvite").addEventListener("click", saveInviteLocal);

    byId("btnCoachPrev").addEventListener("click", () => {
      state.coachIndex = Math.max(0, state.coachIndex - 1);
      renderCoach();
    });

    byId("btnCoachNext").addEventListener("click", () => {
      const len = (state.pool.matches || []).length;
      state.coachIndex = Math.min(Math.max(0, len - 1), state.coachIndex + 1);
      renderCoach();
    });

    byId("importJson").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      importJson(file);
      e.target.value = "";
    });

    byId("matchesList").addEventListener("input", (e) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement)) return;
      const id = el.dataset.id;
      const field = el.dataset.field;
      if (!id || !field) return;
      updateMatch(id, { [field]: el.value });
    });

    byId("matchesList").addEventListener("click", (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      const action = el.dataset.action;
      const id = el.dataset.id;
      if (!action || !id) return;

      if (action === "toggle") {
        const match = (state.pool.matches || []).find(m => m.id === id);
        if (match) updateMatch(id, { done: !match.done });
      }

      if (action === "delete") {
        state.pool.matches = (state.pool.matches || []).filter(m => m.id !== id);
        DB.savePool(state.pool);
        renderMatches();
        renderCoach();
      }
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#039;");
  }

  function init() {
    bindEvents();
    Auth.init();
  }

  return { init, onSignedIn };
})();

window.addEventListener("load", () => {
  window.App.init();
});
