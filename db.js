window.DB = (() => {
  const TEAM_NAME = "NSK Team 18";
  const TEAM_SEASON = "2026";

  async function getClient() {
    if (window.Auth?.init) await Auth.init();
    if (!window.Auth?.getClient) throw new Error("Auth.getClient saknas i auth.js");
    return Auth.getClient();
  }

  async function getTeamId() {
    const client = await getClient();

    let exact = await client.from("nsk_teams").select("id,name,season").eq("name", TEAM_NAME).eq("season", TEAM_SEASON).limit(1).maybeSingle();
    if (exact.error) throw exact.error;
    if (exact.data?.id) return exact.data.id;

    let byName = await client.from("nsk_teams").select("id,name,season").eq("name", TEAM_NAME).limit(1).maybeSingle();
    if (byName.error) throw byName.error;
    if (byName.data?.id) return byName.data.id;

    let anyTeam = await client.from("nsk_teams").select("id,name,season").limit(1).maybeSingle();
    if (anyTeam.error) throw anyTeam.error;
    if (anyTeam.data?.id) return anyTeam.data.id;

    const inserted = await client.from("nsk_teams").insert({ name: TEAM_NAME, season: TEAM_SEASON }).select("id").single();
    if (inserted.error) throw inserted.error;
    return inserted.data.id;
  }

  async function listPlayers() {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data, error } = await client.from("nsk_players").select("id, full_name, sort_order").eq("team_id", teamId).order("sort_order", { ascending: true, nullsFirst: false }).order("full_name", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function addPlayer(name) {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data: maxData } = await client.from("nsk_players").select("sort_order").eq("team_id", teamId).order("sort_order", { ascending: false }).limit(1);
    const nextSort = ((maxData && maxData[0] && maxData[0].sort_order) || 0) + 1;
    const { data, error } = await client.from("nsk_players").insert({ team_id: teamId, full_name: String(name || "").trim(), sort_order: nextSort }).select("*").single();
    if (error) throw error;
    return data;
  }

  async function updatePlayer(id, fullName) {
    const client = await getClient();
    const { data, error } = await client.from("nsk_players").update({ full_name: String(fullName || "").trim() }).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async function deletePlayer(id) {
    const client = await getClient();
    const { error } = await client.from("nsk_players").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function savePlayerOrder(ids) {
    const client = await getClient();
    for (let i = 0; i < ids.length; i++) {
      const { error } = await client.from("nsk_players").update({ sort_order: i + 1 }).eq("id", ids[i]);
      if (error) throw error;
    }
    return true;
  }

  async function listCoaches() {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data, error } = await client.from("nsk_coaches").select("id, full_name, sort_order, role").eq("team_id", teamId).order("sort_order", { ascending: true, nullsFirst: false }).order("full_name", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function addCoach(name) {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data: maxData } = await client.from("nsk_coaches").select("sort_order").eq("team_id", teamId).order("sort_order", { ascending: false }).limit(1);
    const nextSort = ((maxData && maxData[0] && maxData[0].sort_order) || 0) + 1;
    const { data, error } = await client.from("nsk_coaches").insert({ team_id: teamId, full_name: String(name || "").trim(), role: "Tränare", sort_order: nextSort }).select("*").single();
    if (error) throw error;
    return data;
  }

  async function updateCoach(id, fullName) {
    const client = await getClient();
    const { data, error } = await client.from("nsk_coaches").update({ full_name: String(fullName || "").trim() }).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async function deleteCoach(id) {
    const client = await getClient();
    const { error } = await client.from("nsk_coaches").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function saveCoachOrder(ids) {
    const client = await getClient();
    for (let i = 0; i < ids.length; i++) {
      const { error } = await client.from("nsk_coaches").update({ sort_order: i + 1 }).eq("id", ids[i]);
      if (error) throw error;
    }
    return true;
  }

  async function listPools() {
    const client = await getClient();
    const teamId = await getTeamId();
    const { data, error } = await client.from("nsk_pools").select("*").eq("team_id", teamId).order("pool_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function addPool(payload) {
    const client = await getClient();
    const teamId = await getTeamId();
    const row = { team_id: teamId, title: payload.title || payload.pool_name || "Poolspel", place: payload.place || null, pool_date: payload.pool_date || null, status: payload.status || "Aktiv" };
    const { data, error } = await client.from("nsk_pools").insert(row).select("*").single();
    if (error) throw error;
    return data;
  }

  async function listGoalieStats() {
    const client = await getClient();
    const { data, error } = await client.from("nsk_goalie_stats").select("goalie_name, match_id");
    if (error) throw error;
    return data || [];
  }

  async function subscribeTruppen(callback) {
    const client = await getClient();
    return client.channel("realtime-truppen-final")
      .on("postgres_changes", { event: "*", schema: "public", table: "nsk_players" }, payload => callback("players", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "nsk_coaches" }, payload => callback("coaches", payload))
      .subscribe();
  }

  return {
    getTeamId, listPlayers, addPlayer, updatePlayer, deletePlayer, savePlayerOrder,
    listCoaches, addCoach, updateCoach, deleteCoach, saveCoachOrder,
    listPools, addPool, listGoalieStats, subscribeTruppen
  };
})();
