window.App = (() => {
  let state = {
    pool: { id:"", cloud_id:"", name:"", players:[], goalie:"", shiftSeconds:90, matches:[] },
    currentMatchIndex: 0,
    timerSeconds: 0,
    timerHandle: null,
    subscription: null,
    syncTimer: null
  };

  function uid(){ return Math.random().toString(36).slice(2,10); }
  function el(id){ return document.getElementById(id); }

  function setSync(text){
    const s = el("syncStatus");
    if (s) s.textContent = text;
  }

  function setMsg(id, text, color=""){
    const e = el(id);
    if (e) {
      e.textContent = text || "";
      e.style.color = color;
    }
  }

  function saveLocal() {
    DB.save({ pool: state.pool });
  }

  function splitPlayers(text) {
    return String(text || "").split(/\n|,/).map(s => s.trim()).filter(Boolean);
  }

  function formatTime(sec) {
    const m = String(Math.floor(sec/60)).padStart(2,"0");
    const s = String(sec%60).padStart(2,"0");
    return m + ":" + s;
  }

  function escapeHtml(v){
    return String(v || "").replace(/[&<>"]/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[m]));
  }

  function buildLineups(players, shiftSeconds, matchIndex) {
    const list = [...players];
    if (!list.length) return [];
    const size = Math.min(5, Math.max(3, Math.ceil(list.length / 2)));
    const rotations = Math.max(4, Math.ceil((list.length * 1.5) / size));
    const rotated = list.map((_,i)=>list[(i+matchIndex)%list.length]);
    const out = [];
    for (let i=0;i<rotations;i++) {
      const names = [];
      for (let j=0;j<size;j++) names.push(rotated[(i*size+j)%rotated.length]);
      out.push({ no:i+1, players:[...new Set(names)], done:false, seconds:shiftSeconds });
    }
    return out;
  }

  function ensureLineups() {
    state.pool.matches = (state.pool.matches || []).map((m, idx) => ({
      ...m,
      title: m.title || ("Match " + (idx + 1)),
      opponent: m.opponent || "",
      field: m.field || "",
      time: m.time || "",
      activeShift: Number.isFinite(Number(m.activeShift)) ? Number(m.activeShift) : 0,
      lineups: Array.isArray(m.lineups) && m.lineups.length ? m.lineups : buildLineups(state.pool.players || [], state.pool.shiftSeconds || 90, idx)
    }));
  }

  function fillForm() {
    el("poolName").value = state.pool.name || "";
    el("cloudId").value = state.pool.cloud_id || "";
    el("playersInput").value = (state.pool.players || []).join("\n");
    el("goalieInput").value = state.pool.goalie || "";
    el("shiftSeconds").value = state.pool.shiftSeconds || 90;
  }

  function currentLineup(match) {
    if (!match) return null;
    const idx = (match.lineups || []).findIndex(x => !x.done);
    return idx >= 0 ? match.lineups[idx] : (match.lineups?.[match.lineups.length - 1] || null);
  }

  function nextLineup(match, nextMatch) {
    if (match) {
      const idx = (match.lineups || []).findIndex(x => !x.done);
      if (idx >= 0 && match.lineups[idx + 1]) return match.lineups[idx + 1];
    }
    return currentLineup(nextMatch);
  }

  function coachMeta(match, lineup) {
    if (!match || !lineup) return "—";
    return [match.title, match.time || "—", match.opponent ? "mot " + match.opponent : "mot —", match.field ? "plan " + match.field : "plan —", state.pool.goalie ? "mv " + state.pool.goalie : "", "byte " + lineup.no].filter(Boolean).join(" • ");
  }

  function renderCoach() {
    const matches = state.pool.matches || [];
    if (!matches.length) {
      el("coachCurrentMatch").textContent = "—";
      el("coachCurrentPlayers").textContent = "—";
      el("coachNextMatch").textContent = "—";
      el("coachNextPlayers").textContent = "—";
      return;
    }
    state.currentMatchIndex = Math.min(Math.max(0, state.currentMatchIndex), matches.length - 1);
    const match = matches[state.currentMatchIndex];
    const nextMatchObj = matches[state.currentMatchIndex + 1] || null;
    const cur = currentLineup(match);
    const nxt = nextLineup(match, nextMatchObj);
    el("coachCurrentMatch").textContent = coachMeta(match, cur);
    el("coachCurrentPlayers").textContent = cur ? (cur.players || []).join(", ") : "—";
    el("coachNextMatch").textContent = nxt ? coachMeta(nextMatchObj && nxt === currentLineup(nextMatchObj) ? nextMatchObj : match, nxt) : "—";
    el("coachNextPlayers").textContent = nxt ? (nxt.players || []).join(", ") : "—";
  }

  function renderMatches() {
    const wrap = el("matches");
    const matches = state.pool.matches || [];
    if (!matches.length) {
      wrap.innerHTML = '<div class="small">Inga matcher ännu.</div>';
      renderCoach();
      return;
    }
    wrap.innerHTML = matches.map((m, i) => `
      <div class="match">
        <div class="match-top">
          <div>
            <div class="match-title">${escapeHtml(m.title)}</div>
            <div class="small">${escapeHtml(m.time || "—")} • ${m.opponent ? "mot " + escapeHtml(m.opponent) : "mot —"} • ${m.field ? "plan " + escapeHtml(m.field) : "plan —"}</div>
          </div>
          <div class="btnrow">
            <button class="ghost" data-action="focus" data-index="${i}">Coach</button>
            <button class="ghost" data-action="delete" data-index="${i}">Ta bort</button>
          </div>
        </div>
        <div class="row2">
          <input data-field="title" data-index="${i}" value="${escapeHtml(m.title)}" placeholder="Matchnamn">
          <input data-field="time" data-index="${i}" value="${escapeHtml(m.time || "")}" placeholder="10:20">
          <input data-field="opponent" data-index="${i}" value="${escapeHtml(m.opponent || "")}" placeholder="Motståndare">
          <input data-field="field" data-index="${i}" value="${escapeHtml(m.field || "")}" placeholder="Plan">
        </div>
        <div>
          ${(m.lineups || []).map((l, idx) => `
            <div class="lineup-row ${l.done ? "done" : ""}">
              <div>#${l.no}</div>
              <div>${(l.players || []).map(p => `<span class="pill">${escapeHtml(p)}</span>`).join("")}</div>
              <div><button class="ghost" data-action="tick" data-index="${i}" data-lineup="${idx}">${l.done ? "✓" : "○"}</button></div>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");
    renderCoach();
  }

  function scheduleAutosync() {
    if (!state.pool.cloud_id || !Auth.getSession()) return;
    clearTimeout(state.syncTimer);
    state.syncTimer = setTimeout(async () => {
      try {
        setSync("synkar...");
        saveLocal();
        await DB.upsertPool(state.pool);
        setSync("synkad");
      } catch {
        setSync("fel");
      }
    }, 400);
  }

  function savePool() {
    state.pool.name = el("poolName").value.trim();
    state.pool.cloud_id = el("cloudId").value.trim() || ("pool_" + uid());
    state.pool.id = state.pool.id || uid();
    el("cloudId").value = state.pool.cloud_id;
    ensureLineups();
    saveLocal();
    subscribeCurrentPool();
    scheduleAutosync();
    setMsg("poolMsg", "Poolspelet sparat.", "#35d07f");
  }

  async function pullPool() {
    try {
      const id = el("cloudId").value.trim();
      if (!id) return;
      const pool = await DB.fetchPool(id);
      state.pool = pool;
      ensureLineups();
      fillForm();
      renderMatches();
      saveLocal();
      subscribeCurrentPool();
      setSync("hämtad");
      setMsg("poolMsg", "Poolspel hämtat.", "#35d07f");
    } catch (e) {
      setMsg("poolMsg", e.message || String(e), "#ff6b6b");
    }
  }

  function subscribeCurrentPool() {
    if (state.subscription && Auth.getClient()) {
      try { Auth.getClient().removeChannel(state.subscription); } catch {}
      state.subscription = null;
    }
    if (!state.pool.cloud_id || !Auth.getSession()) return;
    state.subscription = DB.subscribePool(state.pool.cloud_id, (pool) => {
      state.pool = pool;
      ensureLineups();
      fillForm();
      renderMatches();
      saveLocal();
      setSync("live");
    });
  }

  function newPool() {
    state.pool = { id:"", cloud_id:"", name:"", players:[], goalie:"", shiftSeconds:90, matches:[] };
    state.currentMatchIndex = 0;
    saveLocal();
    fillForm();
    renderMatches();
    setSync("lokal");
  }

  function savePlayers() {
    state.pool.players = splitPlayers(el("playersInput").value);
    state.pool.goalie = el("goalieInput").value.trim();
    state.pool.shiftSeconds = Math.max(20, Math.min(300, Number(el("shiftSeconds").value || 90)));
    state.pool.matches = (state.pool.matches || []).map((m, idx) => ({ ...m, lineups: buildLineups(state.pool.players, state.pool.shiftSeconds, idx), activeShift: 0 }));
    saveLocal();
    renderMatches();
    scheduleAutosync();
    setMsg("playersMsg", "Spelare sparade och bytesschema byggt.", "#35d07f");
  }

  function addMatch() {
    state.pool.matches.push({
      id: uid(),
      title: "Match " + (state.pool.matches.length + 1),
      time: "",
      opponent: "",
      field: "",
      activeShift: 0,
      lineups: buildLineups(state.pool.players || [], state.pool.shiftSeconds || 90, state.pool.matches.length)
    });
    saveLocal();
    renderMatches();
    scheduleAutosync();
  }

  function updateMatch(index, field, value) {
    const m = state.pool.matches[index];
    if (!m) return;
    m[field] = value;
    saveLocal();
    renderMatches();
    scheduleAutosync();
  }

  function deleteMatch(index) {
    state.pool.matches.splice(index, 1);
    state.currentMatchIndex = Math.min(state.currentMatchIndex, Math.max(0, state.pool.matches.length - 1));
    saveLocal();
    renderMatches();
    scheduleAutosync();
  }

  function tickLineup(matchIndex, lineupIndex) {
    const match = state.pool.matches[matchIndex];
    if (!match || !match.lineups[lineupIndex]) return;
    match.lineups[lineupIndex].done = !match.lineups[lineupIndex].done;
    match.activeShift = Math.max(0, match.lineups.findIndex(x => !x.done));
    saveLocal();
    renderMatches();
    scheduleAutosync();
  }

  function focusMatch(index) {
    state.currentMatchIndex = index;
    renderCoach();
  }

  function startTimer() {
    if (state.timerHandle) return;
    state.timerHandle = setInterval(() => {
      state.timerSeconds += 1;
      el("timer").textContent = formatTime(state.timerSeconds);
      const shiftLen = Number(state.pool.shiftSeconds || 90);
      if (shiftLen && state.timerSeconds > 0 && state.timerSeconds % shiftLen === 0) {
        try { navigator.vibrate && navigator.vibrate([200,100,200]); } catch {}
      }
    }, 1000);
  }

  function pauseTimer() {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }

  function resetTimer() {
    pauseTimer();
    state.timerSeconds = 0;
    el("timer").textContent = "00:00";
  }

  async function toggleFullscreen() {
    document.body.classList.toggle("fullscreen-mode");
    const card = el("coachCard");
    try {
      if (!document.fullscreenElement) await card.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch {}
  }

  function bind() {
    el("loginBtn").onclick = () => Auth.login(el("email").value);
    el("refreshBtn").onclick = () => Auth.refresh();
    el("savePool").onclick = savePool;
    el("pullPool").onclick = pullPool;
    el("newPool").onclick = newPool;
    el("savePlayers").onclick = savePlayers;
    el("rebuildLineups").onclick = savePlayers;
    el("addMatch").onclick = addMatch;
    el("startTimer").onclick = startTimer;
    el("pauseTimer").onclick = pauseTimer;
    el("resetTimer").onclick = resetTimer;
    el("tickShift").onclick = () => {
      const match = state.pool.matches[state.currentMatchIndex];
      if (!match) return;
      const idx = (match.lineups || []).findIndex(x => !x.done);
      if (idx >= 0) tickLineup(state.currentMatchIndex, idx);
    };
    el("prevMatch").onclick = () => { state.currentMatchIndex = Math.max(0, state.currentMatchIndex - 1); renderCoach(); };
    el("nextMatch").onclick = () => { state.currentMatchIndex = Math.min(Math.max(0, state.pool.matches.length - 1), state.currentMatchIndex + 1); renderCoach(); };
    el("coachFullscreen").onclick = toggleFullscreen;

    el("matches").addEventListener("input", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      updateMatch(Number(t.dataset.index), t.dataset.field, t.value);
    });

    el("matches").addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const action = t.dataset.action;
      const index = Number(t.dataset.index);
      if (action === "delete") deleteMatch(index);
      if (action === "focus") focusMatch(index);
      if (action === "tick") tickLineup(index, Number(t.dataset.lineup));
    });
  }

  function init() {
    bind();
    const data = DB.load();
    state.pool = data.pool || state.pool;
    ensureLineups();
    fillForm();
    renderMatches();
    Auth.init().then(() => subscribeCurrentPool());
  }

  return { init };
})();

window.addEventListener("load", () => App.init());
