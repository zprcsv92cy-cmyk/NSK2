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
    coachIndex: 0,
    players: [],
    goalie: "",
    shiftSeconds: 90,
    timer: {
      running: false,
      startedAt: 0,
      elapsedMs: 0,
      intervalId: null
    }
  };

  function uid() {
    return "v6_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
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

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m]));
  }

  function splitNames(text) {
    return String(text || "")
      .split(/\n|,/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function fillForm() {
    byId("poolName").value = state.pool.name || "";
    byId("poolDate").value = state.pool.date || "";
    byId("poolPlace").value = state.pool.place || "";
    byId("poolTeams").value = (state.pool.teams || []).join(", ");
    byId("playersCsv").value = (state.players || []).join("\n");
    byId("goalieName").value = state.goalie || "";
    byId("shiftSeconds").value = state.shiftSeconds || 90;
    updatePlayerCount();
  }

  function readPoolForm() {
    return {
      ...state.pool,
      name: String(byId("poolName").value || "").trim(),
      date: String(byId("poolDate").value || "").trim(),
      place: String(byId("poolPlace").value || "").trim(),
      teams: splitNames(byId("poolTeams").value)
    };
  }

  function savePool() {
    const next = readPoolForm();
    if (!next.name) return setMsg("poolMsg", "Skriv namn på poolspelet.");
    if (!next.date) return setMsg("poolMsg", "Välj datum.");
    next.id = next.id || uid();
    next.matches = Array.isArray(next.matches) ? next.matches : [];
    DB.savePool(next);
    state.pool = next;
    setMsg("poolMsg", "Poolspelet sparat.", true);
    renderMatches();
    renderCoach();
  }

  function savePlayers() {
    const players = splitNames(byId("playersCsv").value);
    const goalie = String(byId("goalieName").value || "").trim();
    const shiftSeconds = Math.max(20, Math.min(300, Number(byId("shiftSeconds").value || 90)));
    state.players = players;
    state.goalie = goalie;
    state.shiftSeconds = shiftSeconds;
    DB.savePlayers(players, goalie, shiftSeconds);
    ensureLineups();
    updatePlayerCount();
    renderMatches();
    renderCoach();
    setMsg("playersMsg", "Spelare sparade.", true);
  }

  function updatePlayerCount() {
    const badge = byId("playerCountBadge");
    if (badge) badge.textContent = `${state.players.length} spelare`;
  }

  function addMatch() {
    const number = (state.pool.matches || []).length + 1;
    const match = {
      id: uid(),
      title: "Match " + number,
      time: "",
      opponent: "",
      field: "",
      done: false,
      lineups: []
    };
    state.pool.matches = [...(state.pool.matches || []), match];
    ensureLineups();
    DB.savePool(state.pool);
    renderMatches();
    renderCoach();
  }

  function updateMatch(id, patch) {
    state.pool.matches = (state.pool.matches || []).map(m => m.id === id ? { ...m, ...patch } : m);
    ensureLineups();
    DB.savePool(state.pool);
    renderMatches();
    renderCoach();
  }

  function removeMatch(id) {
    state.pool.matches = (state.pool.matches || []).filter(m => m.id !== id);
    state.coachIndex = Math.min(state.coachIndex, Math.max(0, state.pool.matches.length - 1));
    DB.savePool(state.pool);
    renderMatches();
    renderCoach();
  }

  function buildLineupsForMatch(matchIndex) {
    const players = [...state.players];
    if (!players.length) return [];
    const groupSize = Math.min(5, Math.max(3, Math.ceil(players.length / 2)));
    const shifts = Math.max(4, Math.ceil(players.length * 1.5 / groupSize));
    const rotated = players.map((name, idx) => players[(idx + matchIndex) % players.length]);
    const lineups = [];
    for (let i = 0; i < shifts; i++) {
      const start = (i * groupSize) % rotated.length;
      const slice = [];
      for (let j = 0; j < groupSize; j++) {
        slice.push(rotated[(start + j) % rotated.length]);
      }
      lineups.push({
        no: i + 1,
        timeLeft: formatMMSS((shifts - i) * state.shiftSeconds),
        players: uniqNames(slice),
        done: false
      });
    }
    return lineups;
  }

  function uniqNames(arr) {
    const seen = new Set();
    const out = [];
    for (const item of arr) {
      const key = String(item).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  function ensureLineups() {
    state.pool.matches = (state.pool.matches || []).map((m, idx) => {
      const lineups = Array.isArray(m.lineups) && m.lineups.length ? m.lineups : buildLineupsForMatch(idx);
      return { ...m, lineups };
    });
  }

  function formatMMSS(totalSeconds) {
    const s = Math.max(0, Number(totalSeconds) || 0);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(Math.floor(s % 60)).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function renderMatches() {
    const wrap = byId("matchesList");
    if (!wrap) return;
    const matches = state.pool.matches || [];
    if (!matches.length) {
      wrap.innerHTML = '<div class="muted">Inga matcher ännu.</div>';
      return;
    }

    wrap.innerHTML = matches.map((m, i) => `
      <div class="match-item">
        <div class="match-head">
          <div>
            <b>${escapeHtml(m.title || ("Match " + (i + 1)))}</b>
            <div class="muted">${escapeHtml(state.pool.date || "—")} • ${escapeHtml(state.pool.place || "—")}</div>
          </div>
          <div class="status ${m.done ? "status-done" : "status-live"}">${m.done ? "Klar" : "Live"}</div>
        </div>

        <div class="row mt8">
          <div>
            <label>Tid</label>
            <input data-id="${m.id}" data-field="time" value="${escapeHtml(m.time || "")}" placeholder="10:00">
          </div>
          <div>
            <label>Motståndare</label>
            <input data-id="${m.id}" data-field="opponent" value="${escapeHtml(m.opponent || "")}" placeholder="Motståndare">
          </div>
          <div>
            <label>Plan</label>
            <input data-id="${m.id}" data-field="field" value="${escapeHtml(m.field || "")}" placeholder="1">
          </div>
        </div>

        <div class="lineup-list">
          ${(m.lineups || []).map((lineup, idx) => `
            <div class="lineup-row ${lineup.done ? "done" : ""}">
              <div><b>#${lineup.no}</b></div>
              <div>${escapeHtml(lineup.timeLeft)}</div>
              <div>${escapeHtml((lineup.players || []).join(", ") || "—")}</div>
              <div>
                <button class="tick ghost" type="button" data-action="tick" data-id="${m.id}" data-lineup="${idx}">${lineup.done ? "✓" : "○"}</button>
              </div>
            </div>
          `).join("")}
        </div>

        <div class="btnrow mt8">
          <button type="button" data-action="toggle" data-id="${m.id}" class="${m.done ? "ghost" : ""}">${m.done ? "Markera ej klar" : "Markera klar"}</button>
          <button type="button" data-action="rebuild" data-id="${m.id}" class="ghost">Bygg om byten</button>
          <button type="button" data-action="delete" data-id="${m.id}" class="ghost">Ta bort</button>
        </div>
      </div>
    `).join("");
  }

  function currentLineupFor(match) {
    const lineups = match?.lineups || [];
    return lineups.find(x => !x.done) || lineups[lineups.length - 1] || null;
  }

  function nextLineupFor(match) {
    const lineups = match?.lineups || [];
    const idx = lineups.findIndex(x => !x.done);
    if (idx === -1) return null;
    return lineups[idx + 1] || null;
  }

  function renderCoach() {
    const matches = state.pool.matches || [];
    if (!matches.length) {
      byId("coachCurrent").textContent = "Ingen match vald";
      byId("coachCurrentMeta").textContent = "—";
      byId("coachNext").textContent = "—";
      byId("coachNextMeta").textContent = "—";
      return;
    }

    if (state.coachIndex < 0) state.coachIndex = 0;
    if (state.coachIndex > matches.length - 1) state.coachIndex = matches.length - 1;

    const curMatch = matches[state.coachIndex];
    const nextMatch = matches[state.coachIndex + 1] || null;
    const curLineup = currentLineupFor(curMatch);
    const nxtLineup = nextLineupFor(curMatch) || currentLineupFor(nextMatch);

    byId("coachCurrent").textContent = curLineup ? (curLineup.players || []).join(", ") : "Inga byten";
    byId("coachCurrentMeta").textContent = buildMeta(curMatch, curLineup);

    byId("coachNext").textContent = nxtLineup ? (nxtLineup.players || []).join(", ") : "Ingen nästa";
    byId("coachNextMeta").textContent = nxtLineup
      ? buildMeta(nextLineupFor(curMatch) ? curMatch : nextMatch, nxtLineup)
      : "—";
  }

  function buildMeta(match, lineup) {
    if (!match || !lineup) return "—";
    const bits = [
      match.title || "",
      match.time || "—",
      match.opponent ? "mot " + match.opponent : "mot —",
      match.field ? "plan " + match.field : "plan —",
      state.goalie ? "målvakt " + state.goalie : ""
    ].filter(Boolean);
    bits.push("byte " + lineup.no);
    bits.push(lineup.timeLeft);
    return bits.join(" • ");
  }

  function tickCurrentLineup() {
    const match = state.pool.matches?.[state.coachIndex];
    if (!match) return;
    const idx = (match.lineups || []).findIndex(x => !x.done);
    if (idx === -1) return;
    toggleLineupDone(match.id, idx);
  }

  function toggleLineupDone(matchId, lineupIndex) {
    state.pool.matches = (state.pool.matches || []).map(m => {
      if (m.id !== matchId) return m;
      const lineups = (m.lineups || []).map((l, idx) => idx === lineupIndex ? { ...l, done: !l.done } : l);
      const done = lineups.length > 0 && lineups.every(l => l.done);
      return { ...m, lineups, done };
    });
    DB.savePool(state.pool);
    renderMatches();
    renderCoach();
  }

  function rebuildOne(matchId) {
    state.pool.matches = (state.pool.matches || []).map((m, idx) =>
      m.id === matchId ? { ...m, lineups: buildLineupsForMatch(idx), done: false } : m
    );
    DB.savePool(state.pool);
    renderMatches();
    renderCoach();
  }

  function rebuildAll() {
    ensureLineups();
    state.pool.matches = (state.pool.matches || []).map((m, idx) => ({
      ...m,
      lineups: buildLineupsForMatch(idx),
      done: false
    }));
    DB.savePool(state.pool);
    renderMatches();
    renderCoach();
    setMsg("playersMsg", "Bytesschemat byggdes om.", true);
  }

  function startTimer() {
    if (state.timer.running) return;
    state.timer.running = true;
    state.timer.startedAt = Date.now() - state.timer.elapsedMs;
    state.timer.intervalId = window.setInterval(updateTimerDisplay, 250);
    updateTimerDisplay();
  }

  function pauseTimer() {
    if (!state.timer.running) return;
    state.timer.running = false;
    state.timer.elapsedMs = Date.now() - state.timer.startedAt;
    window.clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
    updateTimerDisplay();
  }

  function resetTimer() {
    state.timer.running = false;
    state.timer.elapsedMs = 0;
    state.timer.startedAt = 0;
    window.clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const elapsed = state.timer.running ? (Date.now() - state.timer.startedAt) : state.timer.elapsedMs;
    const seconds = Math.floor(elapsed / 1000);
    byId("timerDisplay").textContent = formatMMSS(seconds);
    byId("timerState").textContent = state.timer.running ? "Timer går" : (seconds ? "Pausad" : "Timer stoppad");
  }

  function exportJson() {
    const data = DB.load();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nsk-v6-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      DB.save(data);
      hydrateFromDB();
      fillForm();
      renderMatches();
      renderCoach();
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

  function loadDemo() {
    state.players = ["Alex Andersson", "Benjamin Berg", "Carl Carlsson", "David Dahl", "Elias Eriksson", "Filip Friberg", "Gustav Gran", "Hugo Holm"];
    state.goalie = "Max Målvakt";
    state.shiftSeconds = 90;
    state.pool = {
      id: uid(),
      name: "Demo poolspel",
      date: new Date().toISOString().slice(0, 10),
      place: "Nyköping",
      teams: ["Lag 1", "Lag 2"],
      matches: [
        { id: uid(), title: "Match 1", time: "09:00", opponent: "Oxelösund", field: "1", done: false, lineups: [] },
        { id: uid(), title: "Match 2", time: "10:20", opponent: "Trosa", field: "2", done: false, lineups: [] },
        { id: uid(), title: "Match 3", time: "11:40", opponent: "Gnesta", field: "1", done: false, lineups: [] }
      ]
    };
    ensureLineups();
    DB.savePool(state.pool);
    DB.savePlayers(state.players, state.goalie, state.shiftSeconds);
    fillForm();
    renderMatches();
    renderCoach();
    updateTimerDisplay();
    setMsg("poolMsg", "Demo laddad.", true);
  }

  function hydrateFromDB() {
    const data = DB.load();
    if (Array.isArray(data.pools) && data.pools.length) {
      state.pool = data.pools[0];
    }
    state.players = Array.isArray(data.players) ? data.players : [];
    state.goalie = data.settings?.goalie || "";
    state.shiftSeconds = Number(data.settings?.shiftSeconds || 90);
    ensureLineups();
  }

  function onSignedIn() {
    hydrateFromDB();
    fillForm();
    renderMatches();
    renderCoach();
    updateTimerDisplay();
  }

  function bindEvents() {
    byId("btnSendLink").addEventListener("click", () => Auth.sendMagicLink(String(byId("loginEmail").value || "").trim()));
    byId("btnRefreshSession").addEventListener("click", () => Auth.refreshSession());
    byId("btnLogout").addEventListener("click", () => Auth.logout());

    byId("btnSavePool").addEventListener("click", savePool);
    byId("btnAddMatch").addEventListener("click", addMatch);
    byId("btnLoadDemo").addEventListener("click", loadDemo);
    byId("btnExportJson").addEventListener("click", exportJson);
    byId("btnPrint").addEventListener("click", printPdf);

    byId("btnSavePlayers").addEventListener("click", savePlayers);
    byId("btnRebuildLineup").addEventListener("click", rebuildAll);
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

    byId("btnTimerStart").addEventListener("click", startTimer);
    byId("btnTimerPause").addEventListener("click", pauseTimer);
    byId("btnTimerReset").addEventListener("click", resetTimer);
    byId("btnTickDone").addEventListener("click", tickCurrentLineup);

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
      if (action === "delete") removeMatch(id);
      if (action === "rebuild") rebuildOne(id);
      if (action === "tick") toggleLineupDone(id, Number(el.dataset.lineup));
    });
  }

  function init() {
    bindEvents();
    hydrateFromDB();
    fillForm();
    renderMatches();
    renderCoach();
    updateTimerDisplay();
    Auth.init();
  }

  return { init, onSignedIn };
})();

window.addEventListener("load", () => window.App.init());
