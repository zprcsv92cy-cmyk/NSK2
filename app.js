window.App = (() => {
  let state = {
    pool: { id: "", name: "", date: "", place: "", teams: [], matches: [] },
    coachIndex: 0,
    players: [],
    goalie: "",
    shiftSeconds: 90,
    timerTarget: { matchIndex: 0, shiftIndex: 0 },
    timer: { running: false, startedAt: 0, elapsedMs: 0, intervalId: null }
  };

  const byId = (id) => document.getElementById(id);
  const uid = () => "v62_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

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
    return String(text || "").split(/\n|,/).map(s => s.trim()).filter(Boolean);
  }

  function formatMMSS(totalSeconds) {
    const s = Math.max(0, Number(totalSeconds) || 0);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(Math.floor(s % 60)).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function uniqNames(arr) {
    const seen = new Set(), out = [];
    for (const item of arr) {
      const key = String(item).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  function updateSyncBadge() {
    const data = DB.load();
    const badge = byId("syncBadge");
    if (badge) badge.textContent = data.settings?.syncStatus || "lokal";
  }

  function fillForm() {
    byId("poolName").value = state.pool.name || "";
    byId("poolDate").value = state.pool.date || "";
    byId("poolPlace").value = state.pool.place || "";
    byId("poolTeams").value = (state.pool.teams || []).join(", ");
    byId("playersCsv").value = (state.players || []).join("\n");
    byId("goalieName").value = state.goalie || "";
    byId("shiftSeconds").value = state.shiftSeconds || 90;
    byId("playerCountBadge").textContent = `${state.players.length} spelare`;
    fillTimerSelectors();
    updateSyncBadge();
  }

  function cloudPayload() {
    const data = DB.load();
    return {
      pools: data.pools || [],
      players: data.players || [],
      settings: data.settings || {}
    };
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
      for (let j = 0; j < groupSize; j++) slice.push(rotated[(start + j) % rotated.length]);
      lineups.push({ no: i + 1, timeLeft: formatMMSS((shifts - i) * state.shiftSeconds), players: uniqNames(slice), done: false });
    }
    return lineups;
  }

  function ensureLineups() {
    state.pool.matches = (state.pool.matches || []).map((m, idx) => ({
      ...m,
      timerElapsedMs: Number(m.timerElapsedMs || 0),
      activeShiftIndex: Number.isFinite(Number(m.activeShiftIndex)) ? Number(m.activeShiftIndex) : 0,
      lineups: Array.isArray(m.lineups) && m.lineups.length ? m.lineups : buildLineupsForMatch(idx)
    }));
  }

  function persistPool() {
    DB.savePool(state.pool);
    updateSyncBadge();
  }

  function currentTimerMatch() {
    return state.pool.matches?.[state.timerTarget.matchIndex] || null;
  }

  function fillTimerSelectors() {
    const matchSel = byId("timerMatchSelect");
    const shiftSel = byId("timerShiftSelect");
    if (!matchSel || !shiftSel) return;

    const matches = state.pool.matches || [];
    if (!matches.length) {
      matchSel.innerHTML = `<option value="0">Ingen match</option>`;
      shiftSel.innerHTML = `<option value="0">Inga byten</option>`;
      state.timerTarget = { matchIndex: 0, shiftIndex: 0 };
      return;
    }

    state.timerTarget.matchIndex = Math.min(state.timerTarget.matchIndex, matches.length - 1);
    matchSel.innerHTML = matches.map((m, i) => `<option value="${i}">${escapeHtml(m.title || ("Match " + (i + 1)))}</option>`).join("");
    matchSel.value = String(state.timerTarget.matchIndex);

    const lineups = matches[state.timerTarget.matchIndex].lineups || [];
    state.timerTarget.shiftIndex = Math.min(state.timerTarget.shiftIndex, Math.max(0, lineups.length - 1));
    shiftSel.innerHTML = lineups.length ? lineups.map((l, i) => `<option value="${i}">Byte ${l.no}</option>`).join("") : `<option value="0">Inga byten</option>`;
    shiftSel.value = String(state.timerTarget.shiftIndex);
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

    state.coachIndex = Math.min(Math.max(0, state.coachIndex), matches.length - 1);
    const curMatch = matches[state.coachIndex];
    const nextMatch = matches[state.coachIndex + 1] || null;
    const curLineup = (curMatch.lineups || []).find(x => !x.done) || curMatch.lineups?.[curMatch.lineups.length - 1] || null;
    const nextLineup = (curMatch.lineups || []).find((x, idx, arr) => !x.done && arr[idx + 1]) ? (() => {
      const idx = curMatch.lineups.findIndex(x => !x.done);
      return curMatch.lineups[idx + 1];
    })() : ((nextMatch?.lineups || []).find(x => !x.done) || null);

    byId("coachCurrent").textContent = curLineup ? (curLineup.players || []).join(", ") : "Inga byten";
    byId("coachCurrentMeta").textContent = buildMeta(curMatch, curLineup);
    byId("coachNext").textContent = nextLineup ? (nextLineup.players || []).join(", ") : "Ingen nästa";
    byId("coachNextMeta").textContent = nextLineup ? buildMeta(nextMatch && !(curMatch.lineups || []).some((x, idx, arr) => !x.done && arr[idx + 1]) ? nextMatch : curMatch, nextLineup) : "—";
  }

  function buildMeta(match, lineup) {
    if (!match || !lineup) return "—";
    const bits = [match.title || "", match.time || "—", match.opponent ? "mot " + match.opponent : "mot —", match.field ? "plan " + match.field : "plan —", state.goalie ? "målvakt " + state.goalie : "", "byte " + lineup.no, lineup.timeLeft].filter(Boolean);
    return bits.join(" • ");
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
            <div class="muted">${escapeHtml(state.pool.date || "—")} • ${escapeHtml(state.pool.place || "—")} • timer ${formatMMSS(Math.floor((m.timerElapsedMs || 0) / 1000))}</div>
          </div>
          <div class="status ${m.done ? "status-done" : "status-live"}">${m.done ? "Klar" : "Live"}</div>
        </div>
        <div class="row mt8">
          <div><label>Tid</label><input data-id="${m.id}" data-field="time" value="${escapeHtml(m.time || "")}" placeholder="10:00"></div>
          <div><label>Motståndare</label><input data-id="${m.id}" data-field="opponent" value="${escapeHtml(m.opponent || "")}" placeholder="Motståndare"></div>
          <div><label>Plan</label><input data-id="${m.id}" data-field="field" value="${escapeHtml(m.field || "")}" placeholder="1"></div>
        </div>
        <div class="lineup-list">
          ${(m.lineups || []).map((lineup, idx) => `
            <div class="lineup-row ${lineup.done ? "done" : ""}">
              <div><b>#${lineup.no}</b></div>
              <div>${escapeHtml(lineup.timeLeft)}</div>
              <div>${escapeHtml((lineup.players || []).join(", ") || "—")}</div>
              <div><button class="tick ghost" type="button" data-action="tick" data-id="${m.id}" data-lineup="${idx}">${lineup.done ? "✓" : "○"}</button></div>
            </div>`).join("")}
        </div>
        <div class="btnrow mt8">
          <button type="button" data-action="toggle" data-id="${m.id}" class="${m.done ? "ghost" : ""}">${m.done ? "Markera ej klar" : "Markera klar"}</button>
          <button type="button" data-action="rebuild" data-id="${m.id}" class="ghost">Bygg om byten</button>
          <button type="button" data-action="delete" data-id="${m.id}" class="ghost">Ta bort</button>
        </div>
      </div>`).join("");
  }

  function savePool() {
    const next = readPoolForm();
    if (!next.name) return setMsg("poolMsg", "Skriv namn på poolspelet.");
    if (!next.date) return setMsg("poolMsg", "Välj datum.");
    next.id = next.id || uid();
    next.matches = Array.isArray(next.matches) ? next.matches : [];
    state.pool = next;
    ensureLineups();
    persistPool();
    renderMatches();
    renderCoach();
    fillTimerSelectors();
    setMsg("poolMsg", "Poolspelet sparat.", true);
  }

  function savePlayers() {
    state.players = splitNames(byId("playersCsv").value);
    state.goalie = String(byId("goalieName").value || "").trim();
    state.shiftSeconds = Math.max(20, Math.min(300, Number(byId("shiftSeconds").value || 90)));
    DB.savePlayers(state.players, state.goalie, state.shiftSeconds);
    rebuildAll(false);
    byId("playerCountBadge").textContent = `${state.players.length} spelare`;
    renderMatches();
    renderCoach();
    fillTimerSelectors();
    setMsg("playersMsg", "Spelare sparade.", true);
  }

  function addMatch() {
    const number = (state.pool.matches || []).length + 1;
    state.pool.matches = [...(state.pool.matches || []), { id: uid(), title: "Match " + number, time: "", opponent: "", field: "", done: false, timerElapsedMs: 0, activeShiftIndex: 0, lineups: [] }];
    ensureLineups();
    persistPool();
    renderMatches();
    renderCoach();
    fillTimerSelectors();
  }

  function updateMatch(id, patch) {
    state.pool.matches = (state.pool.matches || []).map(m => m.id === id ? { ...m, ...patch } : m);
    ensureLineups();
    persistPool();
    renderMatches();
    renderCoach();
    fillTimerSelectors();
  }

  function removeMatch(id) {
    state.pool.matches = (state.pool.matches || []).filter(m => m.id !== id);
    state.coachIndex = Math.min(state.coachIndex, Math.max(0, state.pool.matches.length - 1));
    state.timerTarget.matchIndex = Math.min(state.timerTarget.matchIndex, Math.max(0, state.pool.matches.length - 1));
    persistPool();
    renderMatches();
    renderCoach();
    fillTimerSelectors();
  }

  function toggleLineupDone(matchId, lineupIndex) {
    state.pool.matches = (state.pool.matches || []).map(m => {
      if (m.id !== matchId) return m;
      const lineups = (m.lineups || []).map((l, idx) => idx === lineupIndex ? { ...l, done: !l.done } : l);
      const done = lineups.length > 0 && lineups.every(l => l.done);
      const nextActive = lineups.findIndex(l => !l.done);
      return { ...m, lineups, done, activeShiftIndex: nextActive >= 0 ? nextActive : Math.max(0, lineups.length - 1) };
    });
    persistPool();
    renderMatches();
    renderCoach();
    fillTimerSelectors();
  }

  function rebuildOne(matchId) {
    state.pool.matches = (state.pool.matches || []).map((m, idx) => m.id === matchId ? { ...m, lineups: buildLineupsForMatch(idx), done: false, activeShiftIndex: 0, timerElapsedMs: 0 } : m);
    resetTimer(false);
    persistPool();
    renderMatches();
    renderCoach();
    fillTimerSelectors();
  }

  function rebuildAll(showMsg = true) {
    state.pool.matches = (state.pool.matches || []).map((m, idx) => ({ ...m, lineups: buildLineupsForMatch(idx), done: false, activeShiftIndex: 0, timerElapsedMs: 0 }));
    resetTimer(false);
    persistPool();
    if (showMsg) setMsg("playersMsg", "Bytesschemat byggdes om.", true);
  }

  function persistTimerToMatch(elapsedMs) {
    const idx = state.timerTarget.matchIndex;
    state.pool.matches = (state.pool.matches || []).map((m, i) => i === idx ? { ...m, timerElapsedMs: elapsedMs, activeShiftIndex: state.timerTarget.shiftIndex } : m);
    persistPool();
  }

  function updateTimerDisplay() {
    const elapsed = state.timer.running ? (Date.now() - state.timer.startedAt) : state.timer.elapsedMs;
    const seconds = Math.floor(elapsed / 1000);
    byId("timerDisplay").textContent = formatMMSS(seconds);
    byId("timerState").textContent = state.timer.running ? "Timer går" : (seconds ? "Pausad" : "Timer stoppad");
  }

  function startTimer() {
    const match = currentTimerMatch();
    if (!match || state.timer.running) return;
    state.timer.elapsedMs = Number(match.timerElapsedMs || 0);
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
    persistTimerToMatch(state.timer.elapsedMs);
    updateTimerDisplay();
    renderMatches();
  }

  function resetTimer(render = true) {
    state.timer.running = false;
    state.timer.elapsedMs = 0;
    state.timer.startedAt = 0;
    window.clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
    persistTimerToMatch(0);
    if (render) {
      updateTimerDisplay();
      renderMatches();
    }
  }

  function tickCurrentTimerLineup() {
    const match = currentTimerMatch();
    if (!match) return;
    toggleLineupDone(match.id, state.timerTarget.shiftIndex);
  }

  async function syncNow() {
    try {
      await DB.syncNow(cloudPayload());
      updateSyncBadge();
      setMsg("poolMsg", "Synk klar.", true);
    } catch (e) {
      setMsg("poolMsg", "Synk misslyckades: " + (e.message || e));
    }
  }

  async function pullNow() {
    try {
      await DB.pullNow();
      hydrateFromDB();
      fillForm();
      renderMatches();
      renderCoach();
      updateTimerDisplay();
      setMsg("poolMsg", "Molndata hämtad.", true);
    } catch (e) {
      setMsg("poolMsg", "Hämtning misslyckades: " + (e.message || e));
    }
  }

  function exportJson() {
    const data = DB.load();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nsk-v62-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file) {
    if (!file) return;
    try {
      const text = await file.text();
      DB.save(JSON.parse(text));
      hydrateFromDB();
      fillForm();
      renderMatches();
      renderCoach();
      updateTimerDisplay();
      setMsg("poolMsg", "Import klar.", true);
    } catch (e) {
      setMsg("poolMsg", "Import misslyckades: " + (e.message || e));
    }
  }

  function printPdf() { window.print(); }

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
        { id: uid(), title: "Match 1", time: "09:00", opponent: "Oxelösund", field: "1", done: false, timerElapsedMs: 0, activeShiftIndex: 0, lineups: [] },
        { id: uid(), title: "Match 2", time: "10:20", opponent: "Trosa", field: "2", done: false, timerElapsedMs: 0, activeShiftIndex: 0, lineups: [] },
        { id: uid(), title: "Match 3", time: "11:40", opponent: "Gnesta", field: "1", done: false, timerElapsedMs: 0, activeShiftIndex: 0, lineups: [] }
      ]
    };
    DB.savePlayers(state.players, state.goalie, state.shiftSeconds);
    rebuildAll(false);
    persistPool();
    fillForm();
    renderMatches();
    renderCoach();
    updateTimerDisplay();
    setMsg("poolMsg", "Demo laddad.", true);
  }

  function hydrateFromDB() {
    const data = DB.load();
    if (Array.isArray(data.pools) && data.pools.length) state.pool = data.pools[0];
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

    byId("btnSyncNow").addEventListener("click", syncNow);
    byId("btnPullNow").addEventListener("click", pullNow);

    byId("btnSavePool").addEventListener("click", savePool);
    byId("btnAddMatch").addEventListener("click", addMatch);
    byId("btnLoadDemo").addEventListener("click", loadDemo);
    byId("btnExportJson").addEventListener("click", exportJson);
    byId("btnPrint").addEventListener("click", printPdf);
    byId("btnSavePlayers").addEventListener("click", savePlayers);
    byId("btnRebuildLineup").addEventListener("click", () => { rebuildAll(true); renderMatches(); renderCoach(); fillTimerSelectors(); });

    byId("btnCoachPrev").addEventListener("click", () => { state.coachIndex = Math.max(0, state.coachIndex - 1); renderCoach(); });
    byId("btnCoachNext").addEventListener("click", () => { state.coachIndex = Math.min(Math.max(0, (state.pool.matches || []).length - 1), state.coachIndex + 1); renderCoach(); });

    byId("timerMatchSelect").addEventListener("change", (e) => {
      pauseTimer();
      state.timerTarget.matchIndex = Number(e.target.value || 0);
      state.timerTarget.shiftIndex = 0;
      fillTimerSelectors();
      const match = currentTimerMatch();
      state.timer.elapsedMs = Number(match?.timerElapsedMs || 0);
      updateTimerDisplay();
    });
    byId("timerShiftSelect").addEventListener("change", (e) => {
      pauseTimer();
      state.timerTarget.shiftIndex = Number(e.target.value || 0);
      persistTimerToMatch(state.timer.elapsedMs);
    });
    byId("btnTimerStart").addEventListener("click", startTimer);
    byId("btnTimerPause").addEventListener("click", pauseTimer);
    byId("btnTimerReset").addEventListener("click", () => resetTimer(true));
    byId("btnTickDone").addEventListener("click", tickCurrentTimerLineup);

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
