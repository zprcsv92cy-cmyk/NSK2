async function savePoolTeamMatchConfig(payload){
  const client = await getClient();
  const teamId = await getTeamId();

  const row = {
    team_id: teamId,
    pool_id: payload.pool_id,
    lag_no: payload.lag_no,
    match_no: payload.match_no,
    start_time: payload.start_time || null,
    opponent: payload.opponent || "",
    plan: payload.plan || "Plan 1",
    player_count: payload.player_count ?? null,
    goalie_player_id: payload.goalie_player_id || null,
    coach_id: payload.coach_id || null,
    player1_id: payload.player1_id || null,
    player2_id: payload.player2_id || null,
    player3_id: payload.player3_id || null,
    player4_id: payload.player4_id || null,
    player5_id: payload.player5_id || null,
    player6_id: payload.player6_id || null,
    player7_id: payload.player7_id || null,
    player8_id: payload.player8_id || null,
    player9_id: payload.player9_id || null,
    player10_id: payload.player10_id || null
  };

  const { data, error } = await client
    .from("nsk_pool_team_matches")
    .upsert(row, { onConflict: "team_id,pool_id,lag_no,match_no" })
    .select("*")
    .single();

  if(error) throw error;
  return data;
}