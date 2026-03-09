// --- nsk_match_configs patch ---
(function () {
  if (!window.DB) return;

  async function getClient() {
    if (window.Auth?.init) await Auth.init();
    if (!window.Auth?.getClient) {
      throw new Error("Auth.getClient saknas i auth.js");
    }
    return Auth.getClient();
  }

  async function getCurrentPoolId() {
    const saved = sessionStorage.getItem("nsk2_current_pool_id");
    if (saved) return saved;

    if (window.DB.listPools) {
      const pools = await window.DB.listPools();
      if (pools && pools.length) {
        return pools[0].id;
      }
    }

    throw new Error("Inget aktivt poolspel valt.");
  }

  async function upsertMatchConfig(payload) {
    const client = await getClient();
    const pool_id = payload.pool_id || await getCurrentPoolId();

    const row = {
      pool_id,
      team_no: Number(payload.team_no || 1),
      match_no: Number(payload.match_no || 1),
      matches_total: Number(payload.matches_total || 1),
      start_time: payload.start_time || null,
      opponent: payload.opponent || null,
      field: payload.field || null,
      players_total: payload.players_total === "" || payload.players_total == null ? null : Number(payload.players_total),
      players_on_field: payload.players_on_field === "" || payload.players_on_field == null ? null : Number(payload.players_on_field),
      periods: payload.periods === "" || payload.periods == null ? null : Number(payload.periods),
      period_minutes: payload.period_minutes === "" || payload.period_minutes == null ? null : Number(payload.period_minutes),
      shift_seconds: payload.shift_seconds === "" || payload.shift_seconds == null ? null : Number(payload.shift_seconds),
      goalie_name: payload.goalie_name || null,
      player_1: payload.player_1 || null,
      player_2: payload.player_2 || null,
      player_3: payload.player_3 || null,
      player_4: payload.player_4 || null,
      player_5: payload.player_5 || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from("nsk_match_configs")
      .upsert(row, { onConflict: "pool_id,team_no,match_no" })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function getMatchConfig(teamNo, matchNo, poolId) {
    const client = await getClient();
    const pool_id = poolId || await getCurrentPoolId();

    const { data, error } = await client
      .from("nsk_match_configs")
      .select("*")
      .eq("pool_id", pool_id)
      .eq("team_no", Number(teamNo))
      .eq("match_no", Number(matchNo))
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function subscribeMatchConfigs(callback) {
    const client = await getClient();
    return client
      .channel("realtime-nsk_match_configs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nsk_match_configs" },
        payload => callback(payload)
      )
      .subscribe();
  }

  window.DB.upsertMatchConfig = upsertMatchConfig;
  window.DB.getMatchConfig = getMatchConfig;
  window.DB.subscribeMatchConfigs = subscribeMatchConfigs;
})();