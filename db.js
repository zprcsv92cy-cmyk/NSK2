window.DB = (() => {
  const TEAM_NAME = "NSK Team 18";
  const TEAM_SEASON = "2026";

  function getClient() {
    if (window.Auth?.getClient) return window.Auth.getClient();
    throw new Error("Supabase client saknas");
  }

  async function requireClient() {
    if (window.Auth?.init) await window.Auth.init();
    return getClient();
  }

  async function getTeamId() {
    const client = await requireClient();
    const { data, error } = await client
      .from("nsk_teams")
      .select("id")
      .eq("name", TEAM_NAME)
      .eq("season", TEAM_SEASON)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data.id;

    const { data: inserted, error: insertError } = await client
      .from("nsk_teams")
      .insert({ name: TEAM_NAME, season: TEAM_SEASON })
      .select("id")
      .single();

    if (insertError) throw insertError;
    return inserted.id;
  }

  async function listPlayers() {
    const client = await requireClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_players")
      .select("id, full_name, jersey_number, is_active")
      .eq("team_id", teamId)
      .order("full_name", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function addPlayer(fullName, jerseyNumber = null) {
    const client = await requireClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_players")
      .insert({
        team_id: teamId,
        full_name: String(fullName || "").trim(),
        jersey_number: jerseyNumber === "" || jerseyNumber == null ? null : Number(jerseyNumber)
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function updatePlayer(id, fields) {
    const client = await requireClient();
    const patch = {};
    if ("full_name" in fields) patch.full_name = String(fields.full_name || "").trim();
    if ("jersey_number" in fields) patch.jersey_number = fields.jersey_number === "" || fields.jersey_number == null ? null : Number(fields.jersey_number);
    const { data, error } = await client.from("nsk_players").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async function deletePlayer(id) {
    const client = await requireClient();
    const { error } = await client.from("nsk_players").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function listCoaches() {
    const client = await requireClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_coaches")
      .select("id, full_name, role")
      .eq("team_id", teamId)
      .order("full_name", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function addCoach(fullName, role = "Tränare") {
    const client = await requireClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_coaches")
      .insert({ team_id: teamId, full_name: String(fullName || "").trim(), role: String(role || "Tränare") })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function updateCoach(id, fields) {
    const client = await requireClient();
    const patch = {};
    if ("full_name" in fields) patch.full_name = String(fields.full_name || "").trim();
    if ("role" in fields) patch.role = String(fields.role || "Tränare");
    const { data, error } = await client.from("nsk_coaches").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async function deleteCoach(id) {
    const client = await requireClient();
    const { error } = await client.from("nsk_coaches").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function listPools() {
    const client = await requireClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_pools")
      .select("id, title, place, pool_date, status, created_at")
      .eq("team_id", teamId)
      .order("pool_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function addPool({ title, place, pool_date, status = "Aktiv" }) {
    const client = await requireClient();
    const teamId = await getTeamId();
    const { data, error } = await client
      .from("nsk_pools")
      .insert({ team_id: teamId, title, place: place || null, pool_date: pool_date || null, status })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function updatePool(id, fields) {
    const client = await requireClient();
    const { data, error } = await client.from("nsk_pools").update(fields).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async function deletePool(id) {
    const client = await requireClient();
    const { error } = await client.from("nsk_pools").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function listMatchesByPool(poolId) {
    const client = await requireClient();
    const { data, error } = await client
      .from("nsk_matches")
      .select("id, pool_id, title, opponent, place, match_time, status, active_lineup_index, shift_seconds, created_at")
      .eq("pool_id", poolId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function addMatch(payload) {
    const client = await requireClient();
    const { data, error } = await client.from("nsk_matches").insert(payload).select("*").single();
    if (error) throw error;
    return data;
  }

  async function updateMatch(id, fields) {
    const client = await requireClient();
    const { data, error } = await client.from("nsk_matches").update(fields).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async function listLineups(matchId) {
    const client = await requireClient();
    const { data, error } = await client
      .from("nsk_lineups")
      .select("id, match_id, lineup_no, nsk_lineup_players(player_id, nsk_players(id, full_name))")
      .eq("match_id", matchId)
      .order("lineup_no", { ascending: true });
    if (error) throw error;
    return (data || []).map(l => ({
      id: l.id,
      lineup_no: l.lineup_no,
      players: (l.nsk_lineup_players || []).map(x => x.nsk_players).filter(Boolean)
    }));
  }

  async function replaceLineups(matchId, lineups) {
    const client = await requireClient();

    const { data: oldRows, error: oldError } = await client.from("nsk_lineups").select("id").eq("match_id", matchId);
    if (oldError) throw oldError;

    const oldIds = (oldRows || []).map(x => x.id);
    if (oldIds.length) {
      const { error: lpError } = await client.from("nsk_lineup_players").delete().in("lineup_id", oldIds);
      if (lpError) throw lpError;
      const { error: lError } = await client.from("nsk_lineups").delete().eq("match_id", matchId);
      if (lError) throw lError;
    }

    for (let i = 0; i < lineups.length; i++) {
      const row = lineups[i];
      const { data: lineup, error: lineupError } = await client
        .from("nsk_lineups")
        .insert({ match_id: matchId, lineup_no: Number(row.lineup_no || i + 1) })
        .select("id")
        .single();
      if (lineupError) throw lineupError;

      const inserts = (row.player_ids || []).map(pid => ({ lineup_id: lineup.id, player_id: pid }));
      if (inserts.length) {
        const { error: insError } = await client.from("nsk_lineup_players").insert(inserts);
        if (insError) throw insError;
      }
    }
    return true;
  }

  async function listGoalieStats(matchId) {
    const client = await requireClient();
    const { data, error } = await client
      .from("nsk_goalie_stats")
      .select("id, match_id, goalie_name, shots, saves, goals_allowed, created_at")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function addGoalieStat(payload) {
    const client = await requireClient();
    const { data, error } = await client.from("nsk_goalie_stats").insert(payload).select("*").single();
    if (error) throw error;
    return data;
  }

  async function subscribe(table, callback) {
    const client = await requireClient();
    const channel = client.channel("realtime-" + table + "-" + Math.random().toString(36).slice(2));
    channel.on("postgres_changes", { event: "*", schema: "public", table }, payload => callback(payload));
    await channel.subscribe();
    return channel;
  }

  return {
    getTeamId,
    listPlayers, addPlayer, updatePlayer, deletePlayer,
    listCoaches, addCoach, updateCoach, deleteCoach,
    listPools, addPool, updatePool, deletePool,
    listMatchesByPool, addMatch, updateMatch,
    listLineups, replaceLineups,
    listGoalieStats, addGoalieStat,
    subscribe
  };
})();
