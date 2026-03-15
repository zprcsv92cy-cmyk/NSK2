window.DB = (() => {
  const KEY = "nsk_app_data";
  const TEAM_KEY = "nsk_team_id";
  const TEAM_NAME = "NSK Team 18";
  const TEAM_SEASON = "2026";

  function uid() {
    return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function defaults() {
    return {
      pools: [],
      players: [],
      coaches: [],
      pool_team_match_configs: [],
      lineups: [],
      shift_schemas: [],
      goalie_stats: [],
      player_coach_map: []
    };
  }

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw || typeof raw !== "object") return defaults();
      return { ...defaults(), ...raw };
    } catch {
      return defaults();
    }
  }

  function write(data) {
    localStorage.setItem(KEY, JSON.stringify({ ...defaults(), ...(data || {}) }));
  }

  function emitTruppen(type) {
    window.dispatchEvent(new CustomEvent("nsk:truppen", { detail: { type } }));
  }

  function normalizeName(name) {
    return String(name || "").trim();
  }

  async function getClient() {
    try {
      if (window.Auth?.init) await window.Auth.init();
      return window.Auth?.getClient?.() || null;
    } catch {
      return null;
    }
  }

  async function getTeamId() {
    const cached = localStorage.getItem(TEAM_KEY);
    if (cached) return cached;

    const client = await getClient();
    if (!client) return null;

    const exact = await client
      .from("nsk_teams")
      .select("id,name,season")
      .eq("name", TEAM_NAME)
      .eq("season", TEAM_SEASON)
      .limit(1)
      .maybeSingle();

    if (!exact.error && exact.data?.id) {
      localStorage.setItem(TEAM_KEY, exact.data.id);
      return exact.data.id;
    }

    const byName = await client
      .from("nsk_teams")
      .select("id,name,season")
      .eq("name", TEAM_NAME)
      .limit(1)
      .maybeSingle();

    if (!byName.error && byName.data?.id) {
      localStorage.setItem(TEAM_KEY, byName.data.id);
      return byName.data.id;
    }

    const created = await client
      .from("nsk_teams")
      .insert({ name: TEAM_NAME, season: TEAM_SEASON })
      .select("id")
      .single();

    if (created.error) throw created.error;
    localStorage.setItem(TEAM_KEY, created.data.id);
    return created.data.id;
  }

  async function safeSelect(table, builderFn) {
    const client = await getClient();
    if (!client) return { data: null, error: new Error("No Supabase client") };
    try {
      return await builderFn(client.from(table));
    } catch (error) {
      return { data: null, error };
    }
  }

  async function safeMutate(table, builderFn) {
    const client = await getClient();
    if (!client) return { data: null, error: new Error("No Supabase client") };
    try {
      return await builderFn(client.from(table));
    } catch (error) {
      return { data: null, error };
    }
  }

  function mapPoolRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title || "Poolspel",
      place: row.place || "",
      pool_date: row.pool_date || null,
      status: row.status || "Aktiv",
      teams: Number(row.teams || 2),
      matches: Number(row.matches || 4),
      players_on_field: Number(row.players_on_field || 3),
      periods: Number(row.periods || 1),
      period_time: Number(row.period_time || 15),
      sub_time: Number(row.sub_time || 90),
      team_id: row.team_id || null
    };
  }

  // ---------- POOLS ----------

  async function listPools() {
    const client = await getClient();

    try {
      if (client) {
        const teamId = await getTeamId();
        if (teamId) {
          const { data, error } = await safeSelect("nsk_pools", q =>
            q.select("id, team_id, title, place, pool_date, status, teams, matches, players_on_field, periods, period_time, sub_time")
             .eq("team_id", teamId)
             .order("pool_date", { ascending: false })
          );

          if (!error && Array.isArray(data)) {
            const local = read();
            local.pools = data.map(mapPoolRow);
            write(local);
            return local.pools;
          }
        }
      }
    } catch {}

    return read().pools || [];
  }

  async function getPool(id) {
    const localHit = read().pools.find(p => String(p.id) === String(id));
    const client = await getClient();

    try {
      if (client) {
        const { data, error } = await safeSelect("nsk_pools", q =>
          q.select("id, team_id, title, place, pool_date, status, teams, matches, players_on_field, periods, period_time, sub_time")
           .eq("id", id)
           .maybeSingle()
        );

        if (!error && data) {
          const mapped = mapPoolRow(data);
          const local = read();
          const idx = local.pools.findIndex(p => String(p.id) === String(id));
          if (idx >= 0) local.pools[idx] = mapped;
          else local.pools.unshift(mapped);
          write(local);
          return mapped;
        }
      }
    } catch {}

    return localHit || null;
  }

  async function addPool(payload) {
    const row = {
      title: payload.title || "Poolspel",
      place: payload.place || "",
      pool_date: payload.pool_date || null,
      status: payload.status || "Aktiv",
      teams: Number(payload.teams || 2),
      matches: Number(payload.matches || 4),
      players_on_field: Number(payload.players_on_field || 3),
      periods: Number(payload.periods || 1),
      period_time: Number(payload.period_time || 15),
      sub_time: Number(payload.sub_time || 90)
    };

    const client = await getClient();

    if (client) {
      const teamId = await getTeamId();
      const { data, error } = await safeMutate("nsk_pools", q =>
        q.insert({ team_id: teamId, ...row })
         .select("id, team_id, title, place, pool_date, status, teams, matches, players_on_field, periods, period_time, sub_time")
         .single()
      );

      if (!error && data) {
        const mapped = mapPoolRow(data);
        const local = read();
        local.pools = [mapped, ...local.pools.filter(p => String(p.id) !== String(mapped.id))];
        write(local);
        return mapped;
      }
    }

    const local = read();
    const created = { id: uid(), ...row };
    local.pools.unshift(created);
    write(local);
    return created;
  }

  async function updatePool(id, payload) {
    const row = {
      title: payload.title || "Poolspel",
      place: payload.place || "",
      pool_date: payload.pool_date || null,
      status: payload.status || "Aktiv",
      teams: Number(payload.teams || 2),
      matches: Number(payload.matches || 4),
      players_on_field: Number(payload.players_on_field || 3),
      periods: Number(payload.periods || 1),
      period_time: Number(payload.period_time || 15),
      sub_time: Number(payload.sub_time || 90)
    };

    const client = await getClient();

    if (client) {
      const { data, error } = await safeMutate("nsk_pools", q =>
        q.update(row)
         .eq("id", id)
         .select("id, team_id, title, place, pool_date, status, teams, matches, players_on_field, periods, period_time, sub_time")
         .single()
      );

      if (!error && data) {
        const mapped = mapPoolRow(data);
        const local = read();
        const idx = local.pools.findIndex(p => String(p.id) === String(id));
        if (idx >= 0) local.pools[idx] = mapped;
        else local.pools.unshift(mapped);
        write(local);
        return mapped;
      }
    }

    const local = read();
    const idx = local.pools.findIndex(p => String(p.id) === String(id));
    if (idx < 0) throw new Error("Pool hittades inte");
    local.pools[idx] = { ...local.pools[idx], ...row };
    write(local);
    return local.pools[idx];
  }

  async function deletePool(id) {
    const client = await getClient();

    if (client) {
      await safeMutate("nsk_shift_schemas", q => q.delete().eq("pool_id", id));
      await safeMutate("nsk_lineups", q => q.delete().eq("pool_id", id));
      await safeMutate("nsk_pool_team_match_configs", q => q.delete().eq("pool_id", id));
      const { error } = await safeMutate("nsk_pools", q => q.delete().eq("id", id));
      if (error) throw error;
    }

    const local = read();
    local.pools = local.pools.filter(p => String(p.id) !== String(id));
    local.pool_team_match_configs = local.pool_team_match_configs.filter(r => String(r.pool_id) !== String(id));
    local.lineups = local.lineups.filter(r => String(r.pool_id) !== String(id));
    local.shift_schemas = local.shift_schemas.filter(r => String(r.pool_id) !== String(id));
    write(local);
    return true;
  }

  // ---------- PLAYERS ----------

  async function listPlayers() {
    const client = await getClient();

    try {
      if (client) {
        const teamId = await getTeamId();
        if (teamId) {
          const { data, error } = await safeSelect("nsk_players", q =>
            q.select("id, full_name")
             .eq("team_id", teamId)
             .order("full_name", { ascending: true })
          );

          if (!error && Array.isArray(data)) {
            const local = read();
            local.players = data;
            write(local);
            return data;
          }
        }
      }
    } catch {}

    return read().players;
  }

  async function addPlayer(name) {
    const full_name = normalizeName(name);
    if (!full_name) throw new Error("Spelarnamn saknas.");

    const client = await getClient();

    if (client) {
      const teamId = await getTeamId();
      const { data, error } = await safeMutate("nsk_players", q =>
        q.insert({ team_id: teamId, full_name })
         .select("id, full_name")
         .single()
      );

      if (!error && data) {
        const local = read();
        local.players = [...local.players.filter(p => String(p.id) !== String(data.id)), data];
        write(local);
        emitTruppen("players");
        return data;
      }
    }

    const local = read();
    const row = { id: uid(), full_name };
    local.players.push(row);
    write(local);
    emitTruppen("players");
    return row;
  }

  async function updatePlayer(id, name) {
    const full_name = normalizeName(name);
    if (!full_name) throw new Error("Spelarnamn saknas.");

    const client = await getClient();

    if (client) {
      const { data, error } = await safeMutate("nsk_players", q =>
        q.update({ full_name })
         .eq("id", id)
         .select("id, full_name")
         .single()
      );

      if (!error && data) {
        const local = read();
        const idx = local.players.findIndex(p => String(p.id) === String(id));
        if (idx >= 0) local.players[idx] = data;
        else local.players.push(data);
        write(local);
        emitTruppen("players");
        return data;
      }
    }

    const local = read();
    const row = local.players.find(p => String(p.id) === String(id));
    if (!row) throw new Error("Spelare hittades inte.");
    row.full_name = full_name;
    write(local);
    emitTruppen("players");
    return row;
  }

  async function deletePlayer(id) {
    const client = await getClient();

    if (client) {
      const { error } = await safeMutate("nsk_players", q => q.delete().eq("id", id));
      if (error) throw error;
    }

    const local = read();
    local.players = local.players.filter(p => String(p.id) !== String(id));
    write(local);
    emitTruppen("players");
    return true;
  }

  // ---------- COACHES ----------

  async function listCoaches() {
    const client = await getClient();

    try {
      if (client) {
        const teamId = await getTeamId();
        if (teamId) {
          const { data, error } = await safeSelect("nsk_coaches", q =>
            q.select("id, full_name")
             .eq("team_id", teamId)
             .order("full_name", { ascending: true })
          );

          if (!error && Array.isArray(data)) {
            const local = read();
            local.coaches = data;
            write(local);
            return data;
          }
        }
      }
    } catch {}

    return read().coaches;
  }

  async function addCoach(name) {
    const full_name = normalizeName(name);
    if (!full_name) throw new Error("Tränarnamn saknas.");

    const client = await getClient();

    if (client) {
      const teamId = await getTeamId();
      const { data, error } = await safeMutate("nsk_coaches", q =>
        q.insert({ team_id: teamId, full_name })
         .select("id, full_name")
         .single()
      );

      if (!error && data) {
        const local = read();
        local.coaches = [...local.coaches.filter(c => String(c.id) !== String(data.id)), data];
        write(local);
        emitTruppen("coaches");
        return data;
      }
    }

    const local = read();
    const row = { id: uid(), full_name };
    local.coaches.push(row);
    write(local);
    emitTruppen("coaches");
    return row;
  }

  async function updateCoach(id, name) {
    const full_name = normalizeName(name);
    if (!full_name) throw new Error("Tränarnamn saknas.");

    const client = await getClient();

    if (client) {
      const { data, error } = await safeMutate("nsk_coaches", q =>
        q.update({ full_name })
         .eq("id", id)
         .select("id, full_name")
         .single()
      );

      if (!error && data) {
        const local = read();
        const idx = local.coaches.findIndex(c => String(c.id) === String(id));
        if (idx >= 0) local.coaches[idx] = data;
        else local.coaches.push(data);
        write(local);
        emitTruppen("coaches");
        return data;
      }
    }

    const local = read();
    const row = local.coaches.find(c => String(c.id) === String(id));
    if (!row) throw new Error("Tränare hittades inte.");
    row.full_name = full_name;
    write(local);
    emitTruppen("coaches");
    return row;
  }

  async function deleteCoach(id) {
    const client = await getClient();

    if (client) {
      const { error } = await safeMutate("nsk_coaches", q => q.delete().eq("id", id));
      if (error) throw error;
    }

    const local = read();
    local.coaches = local.coaches.filter(c => String(c.id) !== String(id));
    write(local);
    emitTruppen("coaches");
    return true;
  }

  // ---------- MATCH CONFIG / FÖRUTSÄTTNINGAR ----------

  async function listPoolTeamMatchConfigs(poolId) {
    const client = await getClient();

    try {
      if (client) {
        const { data, error } = await safeSelect("nsk_pool_team_match_configs", q =>
          q.select("id, pool_id, lag_no, match_no, start_time, opponent, plan, player_count, goalie_player_id, players_on_field")
           .eq("pool_id", poolId)
           .order("lag_no", { ascending: true })
           .order("match_no", { ascending: true })
        );

        if (!error && Array.isArray(data)) {
          const local = read();
          local.pool_team_match_configs = local.pool_team_match_configs.filter(r => String(r.pool_id) !== String(poolId));
          local.pool_team_match_configs.push(...data.map(r => ({
            ...r,
            players_on_field: Array.isArray(r.players_on_field) ? r.players_on_field.map(String) : []
          })));
          write(local);
          return local.pool_team_match_configs.filter(r => String(r.pool_id) === String(poolId));
        }
      }
    } catch {}

    return read().pool_team_match_configs.filter(r => String(r.pool_id) === String(poolId));
  }

  async function getPoolTeamMatchConfig(poolId, lagNo, matchNo) {
    const rows = await listPoolTeamMatchConfigs(poolId);
    return rows.find(r =>
      String(r.pool_id) === String(poolId) &&
      String(r.lag_no) === String(lagNo) &&
      String(r.match_no) === String(matchNo)
    ) || null;
  }

  async function savePoolTeamMatchConfig(payload) {
    const safePayload = {
      pool_id: payload.pool_id,
      lag_no: Number(payload.lag_no),
      match_no: Number(payload.match_no),
      start_time: payload.start_time || null,
      opponent: payload.opponent || "",
      plan: payload.plan || "Plan 1",
      player_count: Number(payload.player_count || 0),
      goalie_player_id: payload.goalie_player_id || null,
      players_on_field: Array.isArray(payload.players_on_field)
        ? payload.players_on_field.map(String)
        : []
    };

    const client = await getClient();

    if (client) {
      const existing = await safeSelect("nsk_pool_team_match_configs", q =>
        q.select("id")
         .eq("pool_id", safePayload.pool_id)
         .eq("lag_no", safePayload.lag_no)
         .eq("match_no", safePayload.match_no)
         .maybeSingle()
      );

      if (!existing.error && existing.data?.id) {
        const { data, error } = await safeMutate("nsk_pool_team_match_configs", q =>
          q.update(safePayload)
           .eq("id", existing.data.id)
           .select("id, pool_id, lag_no, match_no, start_time, opponent, plan, player_count, goalie_player_id, players_on_field")
           .single()
        );

        if (!error && data) {
          const local = read();
          const idx = local.pool_team_match_configs.findIndex(r => String(r.id) === String(data.id));
          const mapped = { ...data, players_on_field: Array.isArray(data.players_on_field) ? data.players_on_field.map(String) : [] };
          if (idx >= 0) local.pool_team_match_configs[idx] = mapped;
          else local.pool_team_match_configs.push(mapped);
          write(local);
          return mapped;
        }
      }

      const { data, error } = await safeMutate("nsk_pool_team_match_configs", q =>
        q.insert(safePayload)
         .select("id, pool_id, lag_no, match_no, start_time, opponent, plan, player_count, goalie_player_id, players_on_field")
         .single()
      );

      if (!error && data) {
        const local = read();
        const mapped = { ...data, players_on_field: Array.isArray(data.players_on_field) ? data.players_on_field.map(String) : [] };
        local.pool_team_match_configs.push(mapped);
        write(local);
        return mapped;
      }
    }

    const local = read();
    let row = local.pool_team_match_configs.find(r =>
      String(r.pool_id) === String(safePayload.pool_id) &&
      String(r.lag_no) === String(safePayload.lag_no) &&
      String(r.match_no) === String(safePayload.match_no)
    );

    if (!row) {
      row = { id: uid(), ...safePayload };
      local.pool_team_match_configs.push(row);
    } else {
      Object.assign(row, safePayload);
    }

    write(local);
    return row;
  }

  async function getPlayersOnField(poolId, lagNo, matchNo) {
    const players = await listPlayers();
    const row = await getPoolTeamMatchConfig(poolId, lagNo, matchNo);
    const fallback = String(matchNo) !== "1" ? await getPoolTeamMatchConfig(poolId, lagNo, 1) : null;
    const source = row || fallback;
    const ids = Array.isArray(source?.players_on_field) ? source.players_on_field.map(String) : [];
    if (!ids.length) return players;
    return players.filter(p => ids.includes(String(p.id)));
  }

  // ---------- LINEUP ----------

  async function getLineup(matchConfigId) {
    const client = await getClient();

    try {
      if (client) {
        const { data, error } = await safeSelect("nsk_lineups", q =>
          q.select("id, pool_id, match_config_id, person_type, person_id, sort_order")
           .eq("match_config_id", matchConfigId)
           .order("sort_order", { ascending: true })
        );

        if (!error && Array.isArray(data)) {
          const local = read();
          local.lineups = local.lineups.filter(r => String(r.match_config_id) !== String(matchConfigId));
          local.lineups.push(...data);
          write(local);
          return data;
        }
      }
    } catch {}

    return read().lineups
      .filter(l => String(l.match_config_id) === String(matchConfigId))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  async function saveLineup(matchConfigId, playerIds, coachIds) {
    const local = read();
    const matchConfig = local.pool_team_match_configs.find(r => String(r.id) === String(matchConfigId));
    const poolId = matchConfig?.pool_id || null;

    const rows = [];
    let sort = 1;

    (playerIds || []).forEach(p => {
      rows.push({
        id: uid(),
        pool_id: poolId,
        match_config_id: matchConfigId,
        person_type: "player",
        person_id: String(p),
        sort_order: sort++
      });
    });

    (coachIds || []).forEach(c => {
      rows.push({
        id: uid(),
        pool_id: poolId,
        match_config_id: matchConfigId,
        person_type: "coach",
        person_id: String(c),
        sort_order: sort++
      });
    });

    const client = await getClient();

    if (client) {
      await safeMutate("nsk_lineups", q => q.delete().eq("match_config_id", matchConfigId));

      if (rows.length) {
        const { error } = await safeMutate("nsk_lineups", q =>
          q.insert(rows.map(({ id, ...rest }) => rest))
        );
        if (error) throw error;
      }
    }

    local.lineups = local.lineups.filter(l => String(l.match_config_id) !== String(matchConfigId));
    local.lineups.push(...rows);
    write(local);
    return true;
  }

  async function listUsedPlayersInPool(poolId, currentLagNo) {
    const rows = await listPoolTeamMatchConfigs(poolId);
    const local = read();
    const ids = rows
      .filter(r => String(r.lag_no) !== String(currentLagNo))
      .map(r => String(r.id));

    return local.lineups
      .filter(l => l.person_type === "player" && ids.includes(String(l.match_config_id)))
      .map(l => l.person_id);
  }

  // ---------- SHIFT SCHEMA ----------

  async function listShiftSchema(poolId, lagNo, matchNo) {
    const client = await getClient();

    try {
      if (client) {
        const { data, error } = await safeSelect("nsk_shift_schemas", q =>
          q.select("id, pool_id, lag_no, match_no, shift_no, period_no, time_left, players_json, done")
           .eq("pool_id", poolId)
           .eq("lag_no", lagNo)
           .eq("match_no", matchNo)
           .order("shift_no", { ascending: true })
        );

        if (!error && Array.isArray(data)) {
          const local = read();
          local.shift_schemas = local.shift_schemas.filter(s =>
            !(String(s.pool_id) === String(poolId) &&
              String(s.lag_no) === String(lagNo) &&
              String(s.match_no) === String(matchNo))
          );
          local.shift_schemas.push(...data);
          write(local);
          return data;
        }
      }
    } catch {}

    return read().shift_schemas
      .filter(s =>
        String(s.pool_id) === String(poolId) &&
        String(s.lag_no) === String(lagNo) &&
        String(s.match_no) === String(matchNo)
      )
      .sort((a, b) => (a.shift_no || 0) - (b.shift_no || 0));
  }

  async function saveShiftSchema(poolId, lagNo, matchNo, shifts) {
    const rows = (shifts || []).map((s, i) => ({
      id: uid(),
      pool_id: poolId,
      lag_no: Number(lagNo),
      match_no: Number(matchNo),
      shift_no: i + 1,
      period_no: Number(s.period_no || 1),
      time_left: s.time_left || "00:00",
      players_json: Array.isArray(s.players) ? s.players.map(String) : [],
      done: false
    }));

    const client = await getClient();

    if (client) {
      await safeMutate("nsk_shift_schemas", q =>
        q.delete()
         .eq("pool_id", poolId)
         .eq("lag_no", lagNo)
         .eq("match_no", matchNo)
      );

      if (rows.length) {
        const { error } = await safeMutate("nsk_shift_schemas", q =>
          q.insert(rows.map(({ id, ...rest }) => rest))
        );
        if (error) throw error;
      }
    }

    const local = read();
    local.shift_schemas = local.shift_schemas.filter(s =>
      !(String(s.pool_id) === String(poolId) &&
        String(s.lag_no) === String(lagNo) &&
        String(s.match_no) === String(matchNo))
    );
    local.shift_schemas.push(...rows);
    write(local);
    return true;
  }

  async function deleteShiftSchema(poolId, lagNo, matchNo) {
    const client = await getClient();

    if (client) {
      const { error } = await safeMutate("nsk_shift_schemas", q =>
        q.delete()
         .eq("pool_id", poolId)
         .eq("lag_no", lagNo)
         .eq("match_no", matchNo)
      );
      if (error) throw error;
    }

    const local = read();
    local.shift_schemas = local.shift_schemas.filter(s =>
      !(String(s.pool_id) === String(poolId) &&
        String(s.lag_no) === String(lagNo) &&
        String(s.match_no) === String(matchNo))
    );
    write(local);
    return true;
  }

  async function setShiftDone(poolId, lagNo, matchNo, shiftNo, done) {
    const client = await getClient();

    if (client) {
      const { error } = await safeMutate("nsk_shift_schemas", q =>
        q.update({ done: !!done })
         .eq("pool_id", poolId)
         .eq("lag_no", lagNo)
         .eq("match_no", matchNo)
         .eq("shift_no", shiftNo)
      );
      if (error) throw error;
    }

    const local = read();
    const row = local.shift_schemas.find(s =>
      String(s.pool_id) === String(poolId) &&
      String(s.lag_no) === String(lagNo) &&
      String(s.match_no) === String(matchNo) &&
      String(s.shift_no) === String(shiftNo)
    );
    if (row) row.done = !!done;
    write(local);
    return true;
  }

  // ---------- ÖVRIGT ----------

  async function listGoalieStats() {
    const client = await getClient();

    try {
      if (client) {
        const teamId = await getTeamId();
        const { data, error } = await safeSelect("nsk_goalie_stats", q =>
          q.select("id, goalie_name, match_id")
           .eq("team_id", teamId)
        );

        if (!error && Array.isArray(data)) {
          const local = read();
          local.goalie_stats = data;
          write(local);
          return data;
        }
      }
    } catch {}

    return read().goalie_stats;
  }

  async function listPlayerCoachMap() {
    const client = await getClient();

    try {
      if (client) {
        const teamId = await getTeamId();
        const { data, error } = await safeSelect("nsk_player_coach_map", q =>
          q.select("id, player_name, coach_name")
           .eq("team_id", teamId)
           .order("player_name", { ascending: true })
        );

        if (!error && Array.isArray(data)) {
          const local = read();
          local.player_coach_map = data;
          write(local);
          return data;
        }
      }
    } catch {}

    return read().player_coach_map;
  }

  async function savePlayerCoachMap(playerName, coachName) {
    const safePlayer = normalizeName(playerName);
    const safeCoach = normalizeName(coachName);
    if (!safePlayer || !safeCoach) throw new Error("Spelare eller tränare saknas.");

    const client = await getClient();

    if (client) {
      const teamId = await getTeamId();
      const existing = await safeSelect("nsk_player_coach_map", q =>
        q.select("id")
         .eq("team_id", teamId)
         .eq("player_name", safePlayer)
         .maybeSingle()
      );

      if (!existing.error && existing.data?.id) {
        const { data, error } = await safeMutate("nsk_player_coach_map", q =>
          q.update({ coach_name: safeCoach })
           .eq("id", existing.data.id)
           .select("id, player_name, coach_name")
           .single()
        );

        if (!error && data) {
          const local = read();
          const idx = local.player_coach_map.findIndex(r => String(r.id) === String(data.id));
          if (idx >= 0) local.player_coach_map[idx] = data;
          else local.player_coach_map.push(data);
          write(local);
          return data;
        }
      }

      const { data, error } = await safeMutate("nsk_player_coach_map", q =>
        q.insert({ team_id: teamId, player_name: safePlayer, coach_name: safeCoach })
         .select("id, player_name, coach_name")
         .single()
      );

      if (!error && data) {
        const local = read();
        local.player_coach_map.push(data);
        write(local);
        return data;
      }
    }

    const local = read();
    const existingLocal = local.player_coach_map.find(r => r.player_name === safePlayer);
    if (existingLocal) {
      existingLocal.coach_name = safeCoach;
      write(local);
      return existingLocal;
    }

    const row = { id: uid(), player_name: safePlayer, coach_name: safeCoach };
    local.player_coach_map.push(row);
    write(local);
    return row;
  }

  async function subscribeTruppen(callback) {
    const handler = (event) => {
      if (typeof callback === "function") callback(event.detail?.type || "");
    };

    window.addEventListener("nsk:truppen", handler);

    return {
      unsubscribe() {
        window.removeEventListener("nsk:truppen", handler);
      }
    };
  }

  return {
    listPools,
    getPool,
    addPool,
    updatePool,
    deletePool,
    listPlayers,
    addPlayer,
    updatePlayer,
    deletePlayer,
    listCoaches,
    addCoach,
    updateCoach,
    deleteCoach,
    getPoolTeamMatchConfig,
    listPoolTeamMatchConfigs,
    savePoolTeamMatchConfig,
    getPlayersOnField,
    getLineup,
    saveLineup,
    listUsedPlayersInPool,
    saveShiftSchema,
    listShiftSchema,
    deleteShiftSchema,
    setShiftDone,
    listGoalieStats,
    listPlayerCoachMap,
    savePlayerCoachMap,
    subscribeTruppen
  };
})();