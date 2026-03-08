window.NSK2 = (() => {
  const KEY = "nsk2_v1_state";

  const state = load();

  function defaults() {
    return {
      players: [
        "Agnes Danielsson","Albert Zillén","Albin Andersson","Aron Warensjö-Sommar","August Hasselberg",
        "Benjamin Linderström","Charlie Carman","Emil Tranborg","Enzo Olsson","Gunnar Englund",
        "Henry Gauffin","Linus Stolt","Melker Axbom","Måns Åkvist","Nelson Östergren",
        "Nicky Selander","Nikola Kosoderc","Noé Bonnafous Sand","Oliver Engström","Oliver Zoumblïos",
        "Pelle Åstrand","Simon Misiorny","Sixten Bratt","Theo Ydrenius","Viggo Kronvall","Yuktha reddy Semberi"
      ],
      coaches: [
        "Fredrik Selander","Joakim Lund","Linus Öhman","Niklas Gauffin",
        "Olle Åstrand","Peter Hasselberg","Tommy Englund","William Åkvist"
      ],
      pools: [],
      goalieStats: [],
      lineups: [],
      currentMatch: {
        title: "",
        opponent: "",
        place: "",
        time: "",
        activeIndex: 0,
        shiftSeconds: 90
      }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
    } catch {
      return defaults();
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function byId(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
    }[m]));
  }

  function norm(s) { return String(s || "").trim(); }

  function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text || "";
  }

  function setHtml(id, html) {
    const el = byId(id);
    if (el) el.innerHTML = html || "";
  }

  function sorted(list) {
    return [...list].sort((a, b) => a.localeCompare(b, "sv"));
  }

  function uniquePush(list, value) {
    if (!list.some(x => x.toLowerCase() === value.toLowerCase())) {
      list.push(value);
      return true;
    }
    return false;
  }

  function currentPath() {
    return location.pathname;
  }

  function activateMenu() {
    document.querySelectorAll(".mainmenu a").forEach(a => {
      const href = a.getAttribute("href");
      if (href && currentPath().startsWith(href)) a.classList.add("active");
    });
  }

  // ---------- Startsida ----------
  function renderHome() {
    const box = byId("savedPoolsList");
    if (!box) return;
    if (!state.pools.length) {
      box.innerHTML = '<div class="listrow">Inga sparade poolspel ännu.</div>';
      return;
    }
    box.innerHTML = state.pools
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .map((p, i) => `
        <article class="pool-item">
          <div class="pool-top">
            <div>
              <div class="pool-title">${esc(p.date || "Utan datum")} • ${esc(p.place || "Utan plats")}</div>
              <div class="pool-meta">${esc(p.name || "Poolspel")} ${p.matches?.length ? "• " + p.matches.length + " matcher" : ""}</div>
            </div>
            <div class="status-badge">${esc(p.status || "Aktiv")}</div>
          </div>
          <div class="pool-actions">
            <button data-open-pool="${i}">Påbörja poolspel</button>
            <button class="ghost" data-edit-pool="${i}">Redigera</button>
            <button class="ghost" data-delete-pool="${i}">Ta bort</button>
          </div>
        </article>
      `).join("");
  }

  // ---------- Truppen ----------
  function renderPeople(containerId, list, type) {
    const container = byId(containerId);
    if (!container) return;
    container.innerHTML = sorted(list).map(name => `
      <div class="person-row">
        <div class="person-name">${esc(name)}</div>
        <button class="row-btn" data-edit="${type}" data-name="${encodeURIComponent(name)}">Redigera</button>
        <button class="row-btn" data-remove="${type}" data-name="${encodeURIComponent(name)}">Ta bort</button>
      </div>
    `).join("") || `<div class="muted-note">Tom lista.</div>`;
  }

  function renderTeamPage() {
    renderPeople("playersList", state.players, "player");
    renderPeople("coachesList", state.coaches, "coach");
    setText("teamCount", String(state.players.length));
  }

  function addPerson(type, inputId, msgId) {
    const value = norm(byId(inputId)?.value);
    if (!value) return setText(msgId, "Skriv ett namn.");
    const list = type === "player" ? state.players : state.coaches;
    if (!uniquePush(list, value)) return setText(msgId, "Finns redan.");
    save();
    renderTeamPage();
    byId(inputId).value = "";
    setText(msgId, "Sparad.");
  }

  function removePerson(type, name) {
    const decoded = decodeURIComponent(name);
    const list = type === "player" ? state.players : state.coaches;
    const idx = list.findIndex(x => x === decoded);
    if (idx >= 0) {
      list.splice(idx, 1);
      save();
      renderTeamPage();
    }
  }

  function editPerson(type, name) {
    const decoded = decodeURIComponent(name);
    const next = prompt("Redigera namn", decoded);
    const clean = norm(next);
    if (!clean || clean === decoded) return;
    const list = type === "player" ? state.players : state.coaches;
    const idx = list.findIndex(x => x === decoded);
    if (idx >= 0) {
      list[idx] = clean;
      save();
      renderTeamPage();
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nsk2-backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setText("backupMsg", "Export klar.");
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || "{}"));
        state.players = Array.isArray(data.players) ? data.players.map(norm).filter(Boolean) : [];
        state.coaches = Array.isArray(data.coaches) ? data.coaches.map(norm).filter(Boolean) : [];
        state.pools = Array.isArray(data.pools) ? data.pools : [];
        state.goalieStats = Array.isArray(data.goalieStats) ? data.goalieStats : [];
        state.lineups = Array.isArray(data.lineups) ? data.lineups : [];
        state.currentMatch = typeof data.currentMatch === "object" && data.currentMatch ? data.currentMatch : defaults().currentMatch;
        save();
        renderAll();
        setText("backupMsg", "Import klar.");
      } catch {
        setText("backupMsg", "Kunde inte läsa filen.");
      }
    };
    reader.readAsText(file);
  }

  // ---------- Poolspel ----------
  function renderPoolPage() {
    const list = byId("poolPageList");
    if (!list) return;
    if (!state.pools.length) {
      list.innerHTML = '<div class="listrow">Inga poolspel ännu.</div>';
      return;
    }
    list.innerHTML = state.pools.map((p, i) => `
      <div class="listrow">
        <strong>${esc(p.name || "Poolspel")}</strong> – ${esc(p.date || "utan datum")} – ${esc(p.place || "utan plats")}
        <button class="ghost" data-load-pool="${i}" style="margin-left:10px">Ladda</button>
      </div>
    `).join("");
  }

  function savePool() {
    const name = norm(byId("poolName")?.value);
    const place = norm(byId("poolPlace")?.value);
    const date = norm(byId("poolDate")?.value);
    if (!name) return setText("poolMsg", "Skriv namn på poolspelet.");
    state.pools.unshift({
      name, place, date,
      status: "Aktiv",
      matches: []
    });
    save();
    renderPoolPage();
    renderHome();
    setText("poolMsg", "Poolspel sparat.");
    ["poolName","poolPlace","poolDate"].forEach(id => { const el = byId(id); if (el) el.value = ""; });
  }

  // ---------- Målvaktsstatistik ----------
  function renderGoalieStats() {
    const list = byId("goalieStatsList");
    if (!list) return;
    if (!state.goalieStats.length) {
      list.innerHTML = '<div class="listrow">Ingen statistik ännu.</div>';
      return;
    }
    list.innerHTML = state.goalieStats.map(g => {
      const shots = Number(g.shots || 0);
      const saves = Number(g.saves || 0);
      const pct = shots > 0 ? Math.round((saves / shots) * 100) : 0;
      return `<div class="listrow"><strong>${esc(g.name)}</strong> – Skott: ${shots}, Räddningar: ${saves}, Insläppta: ${esc(g.goals)}, Räddningsprocent: ${pct}%</div>`;
    }).join("");
  }

  function saveGoalieStat() {
    const name = norm(byId("goalieName")?.value);
    const shots = norm(byId("goalieShots")?.value);
    const saves = norm(byId("goalieSaves")?.value);
    const goals = norm(byId("goalieGoals")?.value);
    if (!name) return setText("goalieMsg", "Skriv målvaktens namn.");
    state.goalieStats.unshift({ name, shots, saves, goals });
    save();
    renderGoalieStats();
    setText("goalieMsg", "Statistik sparad.");
    ["goalieName","goalieShots","goalieSaves","goalieGoals"].forEach(id => { const el = byId(id); if (el) el.value = ""; });
  }

  // ---------- Bytesschema ----------
  function generateLineups() {
    const names = [...state.players];
    if (!names.length) return setText("lineupMsg", "Lägg till spelare i truppen först.");
    const size = Math.min(5, Math.max(3, Math.ceil(names.length / 2)));
    const out = [];
    for (let i = 0; i < 4; i++) {
      const block = [];
      for (let j = 0; j < size; j++) block.push(names[(i * size + j) % names.length]);
      out.push({ no: i + 1, players: [...new Set(block)] });
    }
    state.lineups = out;
    save();
    renderLineups();
    setText("lineupMsg", "Bytesschema genererat.");
  }

  function renderLineups() {
    const list = byId("lineupList");
    if (!list) return;
    if (!state.lineups.length) {
      list.innerHTML = '<div class="listrow">Inget bytesschema ännu.</div>';
      return;
    }
    list.innerHTML = state.lineups.map(l => `<div class="listrow"><strong>Byte ${l.no}</strong> – ${l.players.map(esc).join(", ")}</div>`).join("");
  }

  // ---------- Matchvy ----------
  let timerHandle = null;

  function renderMatch() {
    setHtml("matchInfo", `
      <div class="listrow">Match: ${esc(state.currentMatch.title || "—")}</div>
      <div class="listrow">Motståndare: ${esc(state.currentMatch.opponent || "—")}</div>
      <div class="listrow">Plats: ${esc(state.currentMatch.place || "—")}</div>
      <div class="listrow">Tid: ${esc(state.currentMatch.time || "—")}</div>
    `);

    const current = state.lineups[state.currentMatch.activeIndex] || { players: [] };
    const next = state.lineups[(state.currentMatch.activeIndex + 1) % Math.max(state.lineups.length, 1)] || { players: [] };
    setText("currentPlayers", current.players.join(" • ") || "—");
    setText("nextPlayers", next.players.join(" • ") || "—");
    setText("shiftLabel", state.lineups.length ? `Byte ${state.currentMatch.activeIndex + 1} / ${state.lineups.length}` : "Inget schema");
  }

  function saveMatchMeta() {
    state.currentMatch.title = norm(byId("matchTitle")?.value);
    state.currentMatch.opponent = norm(byId("matchOpponent")?.value);
    state.currentMatch.place = norm(byId("matchPlace")?.value);
    state.currentMatch.time = norm(byId("matchTime")?.value);
    state.currentMatch.shiftSeconds = Math.max(20, Math.min(300, Number(byId("matchShiftSeconds")?.value || 90)));
    save();
    renderMatch();
    setText("matchMsg", "Matchinfo sparad.");
  }

  function nextShift() {
    if (!state.lineups.length) return;
    state.currentMatch.activeIndex = (state.currentMatch.activeIndex + 1) % state.lineups.length;
    save();
    renderMatch();
  }

  function startTimer() {
    if (timerHandle) return;
    let elapsed = 0;
    const timer = byId("matchTimer");
    timerHandle = setInterval(() => {
      elapsed += 1;
      const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const s = String(elapsed % 60).padStart(2, "0");
      if (timer) timer.textContent = `${m}:${s}`;
      if (elapsed >= (state.currentMatch.shiftSeconds || 90)) {
        elapsed = 0;
        nextShift();
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerHandle);
    timerHandle = null;
  }

  // ---------- Lag ----------
  function renderClubPage() {
    setText("playersTotal", String(state.players.length));
    setText("coachesTotal", String(state.coaches.length));
    setText("poolsTotal", String(state.pools.length));
  }

  function renderAll() {
    activateMenu();
    renderHome();
    renderTeamPage();
    renderPoolPage();
    renderGoalieStats();
    renderLineups();
    renderMatch();
    renderClubPage();
  }

  function bind() {
    byId("addPlayerBtn")?.addEventListener("click", () => addPerson("player", "playerInput", "playersMsg"));
    byId("addCoachBtn")?.addEventListener("click", () => addPerson("coach", "coachInput", "coachesMsg"));
    byId("exportBtn")?.addEventListener("click", exportJson);
    byId("importFile")?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importJson(file);
    });

    byId("savePoolBtn")?.addEventListener("click", savePool);
    byId("saveGoalieStatBtn")?.addEventListener("click", saveGoalieStat);
    byId("generateLineupsBtn")?.addEventListener("click", generateLineups);
    byId("saveMatchBtn")?.addEventListener("click", saveMatchMeta);
    byId("nextShiftBtn")?.addEventListener("click", nextShift);
    byId("startTimerBtn")?.addEventListener("click", startTimer);
    byId("stopTimerBtn")?.addEventListener("click", stopTimer);

    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;

      if (t.dataset.remove) removePerson(t.dataset.remove, t.dataset.name);
      if (t.dataset.edit) editPerson(t.dataset.edit, t.dataset.name);

      if (t.dataset.deletePool) {
        state.pools.splice(Number(t.dataset.deletePool), 1);
        save();
        renderHome();
        renderPoolPage();
      }

      if (t.dataset.editPool) {
        const idx = Number(t.dataset.editPool);
        const p = state.pools[idx];
        if (!p) return;
        const nextName = prompt("Redigera poolspel", p.name || "");
        if (nextName) {
          p.name = norm(nextName);
          save();
          renderHome();
          renderPoolPage();
        }
      }

      if (t.dataset.openPool || t.dataset.loadPool) {
        const idx = Number(t.dataset.openPool ?? t.dataset.loadPool);
        const p = state.pools[idx];
        if (!p) return;
        state.currentMatch.title = p.name || "";
        state.currentMatch.place = p.place || "";
        state.currentMatch.time = p.date || "";
        save();
        location.href = "/NSK2/matchvy/";
      }
    });
  }

  function init() {
    bind();
    renderAll();
  }

  return { init, state };
})();

window.addEventListener("DOMContentLoaded", () => window.NSK2.init());
