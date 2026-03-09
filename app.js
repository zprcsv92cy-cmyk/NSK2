// --- autosave skapa poolspel per lag + match ---
(function () {
  if (!window.NSK2App) return;

  function byId(id) {
    return document.getElementById(id);
  }

  function val(id) {
    return byId(id)?.value ?? "";
  }

  function setVal(id, value) {
    const el = byId(id);
    if (el) el.value = value ?? "";
  }

  function setMsg(text) {
    const el = byId("poolConfigMsg");
    if (el) el.textContent = text || "";
  }

  function getSelectedConfig() {
    return {
      team_no: val("cfgTeamNo"),
      matches_total: val("cfgMatchesTotal"),
      match_no: val("cfgMatchNo"),
      start_time: val("cfgStartTime"),
      opponent: val("cfgOpponent"),
      field: val("cfgField"),
      players_total: val("cfgPlayersTotal"),
      players_on_field: val("cfgPlayersOnField"),
      periods: val("cfgPeriods"),
      period_minutes: val("cfgPeriodMinutes"),
      shift_seconds: val("cfgShiftSeconds"),
      player_1: val("matchPlayer1"),
      player_2: val("matchPlayer2"),
      player_3: val("matchPlayer3"),
      player_4: val("matchPlayer4"),
      player_5: val("matchPlayer5"),
      goalie_name: val("matchGoalie")
    };
  }

  let saveTimer = null;
  let loadingConfig = false;

  async function fillPlayerDropdowns() {
    if (!window.DB.listPlayers) return;

    const ids = [
      "matchPlayer1",
      "matchPlayer2",
      "matchPlayer3",
      "matchPlayer4",
      "matchPlayer5",
      "matchGoalie"
    ];

    const players = await window.DB.listPlayers();

    ids.forEach((id) => {
      const el = byId(id);
      if (!el) return;

      const current = el.value || "";
      el.innerHTML =
        '<option value="">Välj...</option>' +
        players
          .map((p) => {
            const name = String(p.full_name || "");
            const safe = name.replace(/"/g, "&quot;");
            return `<option value="${safe}">${name}</option>`;
          })
          .join("");

      if (current) el.value = current;
    });
  }

  async function loadSelectedConfig() {
    if (!window.DB.getMatchConfig) return;

    const teamNo = val("cfgTeamNo") || "1";
    const matchNo = val("cfgMatchNo") || "1";

    loadingConfig = true;
    try {
      const row = await window.DB.getMatchConfig(teamNo, matchNo);

      if (row) {
        setVal("cfgMatchesTotal", row.matches_total);
        setVal("cfgStartTime", row.start_time);
        setVal("cfgOpponent", row.opponent);
        setVal("cfgField", row.field);
        setVal("cfgPlayersTotal", row.players_total);
        setVal("cfgPlayersOnField", row.players_on_field);
        setVal("cfgPeriods", row.periods);
        setVal("cfgPeriodMinutes", row.period_minutes);
        setVal("cfgShiftSeconds", row.shift_seconds);
        setVal("matchPlayer1", row.player_1);
        setVal("matchPlayer2", row.player_2);
        setVal("matchPlayer3", row.player_3);
        setVal("matchPlayer4", row.player_4);
        setVal("matchPlayer5", row.player_5);
        setVal("matchGoalie", row.goalie_name);
        setMsg("Laddad från Supabase.");
      } else {
        setMsg("Ny konfiguration.");
      }
    } catch (err) {
      const e = byId("appError");
      if (e) e.textContent = err.message || String(err);
    } finally {
      loadingConfig = false;
    }
  }

  async function saveSelectedConfig() {
    if (loadingConfig || !window.DB.upsertMatchConfig) return;

    try {
      await window.DB.upsertMatchConfig(getSelectedConfig());
      setMsg("Autosparat i Supabase.");
    } catch (err) {
      const e = byId("appError");
      if (e) e.textContent = err.message || String(err);
    }
  }

  function queueSave() {
    if (loadingConfig) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSelectedConfig, 400);
  }

  function bindAutosave() {
    const ids = [
      "cfgTeamNo",
      "cfgMatchesTotal",
      "cfgMatchNo",
      "cfgStartTime",
      "cfgOpponent",
      "cfgField",
      "cfgPlayersTotal",
      "cfgPlayersOnField",
      "cfgPeriods",
      "cfgPeriodMinutes",
      "cfgShiftSeconds",
      "matchPlayer1",
      "matchPlayer2",
      "matchPlayer3",
      "matchPlayer4",
      "matchPlayer5",
      "matchGoalie"
    ];

    ids.forEach((id) => {
      const el = byId(id);
      if (!el) return;

      const eventName =
        el.tagName === "INPUT" && el.type === "text" ? "input" : "change";

      el.addEventListener(eventName, async () => {
        if (id === "cfgTeamNo" || id === "cfgMatchNo") {
          await loadSelectedConfig();
        } else {
          queueSave();
        }
      });
    });

    byId("saveMatchConfigBtn")?.addEventListener("click", saveSelectedConfig);
  }

  const oldInit = window.NSK2App.init;

  window.NSK2App.init = async function () {
    if (oldInit) await oldInit();

    if (!byId("cfgTeamNo")) return;

    await fillPlayerDropdowns();
    bindAutosave();
    await loadSelectedConfig();

    if (window.DB.subscribeMatchConfigs) {
      await window.DB.subscribeMatchConfigs(async () => {
        await fillPlayerDropdowns();
        await loadSelectedConfig();
      });
    }
  };
})();