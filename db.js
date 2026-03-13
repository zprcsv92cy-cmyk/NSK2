
// Full db.js with pool, trupp, lineup and shift support
window.DB = (() => {
  const KEY = "nsk_v73";

  function uid(){
    return Math.random().toString(36).slice(2)+Date.now().toString(36);
  }

  function defaults(){
    return {
      pools:[],
      players:[],
      coaches:[],
      pool_team_match_configs:[],
      lineups:[],
      shift_schemas:[],
      goalie_stats:[],
      player_coach_map:[]
    };
  }

  function read(){
    try{
      const raw = JSON.parse(localStorage.getItem(KEY));
      if(!raw || typeof raw !== "object") return defaults();
      return {...defaults(),...raw};
    }catch{
      return defaults();
    }
  }

  function write(data){
    localStorage.setItem(KEY,JSON.stringify(data));
  }

  // ---------- POOLS ----------

  async function listPools(){
    return read().pools;
  }

  async function getPool(id){
    return read().pools.find(p=>String(p.id)===String(id))||null;
  }

  async function addPool(payload){
    const data = read();
    const pool = {...payload,id:uid()};
    data.pools.unshift(pool);
    write(data);
    return pool;
  }

  async function updatePool(id,payload){
    const data = read();
    const i = data.pools.findIndex(p=>String(p.id)===String(id));
    if(i<0) throw new Error("Pool hittades inte");
    data.pools[i] = {...data.pools[i],...payload};
    write(data);
    return data.pools[i];
  }

  async function deletePool(id){
    const data = read();
    data.pools = data.pools.filter(p=>String(p.id)!==String(id));
    write(data);
    return true;
  }

  // ---------- PLAYERS ----------

  async function listPlayers(){
    return read().players;
  }

  async function addPlayer(name){
    const data = read();
    const row = {id:uid(),full_name:name};
    data.players.push(row);
    write(data);
    return row;
  }

  async function updatePlayer(id,name){
    const data = read();
    const r = data.players.find(p=>String(p.id)===String(id));
    if(r) r.full_name=name;
    write(data);
    return r;
  }

  async function deletePlayer(id){
    const data = read();
    data.players = data.players.filter(p=>String(p.id)!==String(id));
    write(data);
    return true;
  }

  // ---------- COACHES ----------

  async function listCoaches(){
    return read().coaches;
  }

  async function addCoach(name){
    const data = read();
    const row = {id:uid(),full_name:name};
    data.coaches.push(row);
    write(data);
    return row;
  }

  async function updateCoach(id,name){
    const data = read();
    const r = data.coaches.find(c=>String(c.id)===String(id));
    if(r) r.full_name=name;
    write(data);
    return r;
  }

  async function deleteCoach(id){
    const data = read();
    data.coaches = data.coaches.filter(c=>String(c.id)!==String(id));
    write(data);
    return true;
  }

  // ---------- MATCH CONFIG ----------

  async function getPoolTeamMatchConfig(poolId,lagNo,matchNo){
    const data = read();
    return data.pool_team_match_configs.find(r=>
      String(r.pool_id)===String(poolId) &&
      String(r.lag_no)===String(lagNo) &&
      String(r.match_no)===String(matchNo)
    )||null;
  }

  async function listPoolTeamMatchConfigs(poolId){
    const data = read();
    return data.pool_team_match_configs.filter(r=>String(r.pool_id)===String(poolId));
  }

  async function savePoolTeamMatchConfig(payload){
    const data = read();

    let row = data.pool_team_match_configs.find(r=>
      String(r.pool_id)===String(payload.pool_id) &&
      String(r.lag_no)===String(payload.lag_no) &&
      String(r.match_no)===String(payload.match_no)
    );

    if(!row){
      row={id:uid(),...payload};
      data.pool_team_match_configs.push(row);
    }else{
      Object.assign(row,payload);
    }

    write(data);
    return row;
  }

  // ---------- LINEUP ----------

  async function getLineup(matchConfigId){
    const data = read();
    return data.lineups
      .filter(l=>String(l.match_config_id)===String(matchConfigId))
      .sort((a,b)=>a.sort_order-b.sort_order);
  }

  async function saveLineup(matchConfigId,playerIds,coachIds){
    const data = read();

    data.lineups = data.lineups.filter(l=>String(l.match_config_id)!==String(matchConfigId));

    let sort=1;

    playerIds.forEach(p=>{
      data.lineups.push({
        id:uid(),
        match_config_id:matchConfigId,
        person_type:"player",
        person_id:p,
        sort_order:sort++
      });
    });

    coachIds.forEach(c=>{
      data.lineups.push({
        id:uid(),
        match_config_id:matchConfigId,
        person_type:"coach",
        person_id:c,
        sort_order:sort++
      });
    });

    write(data);
    return true;
  }

  async function listUsedPlayersInPool(poolId,currentLagNo){
    const rows = await listPoolTeamMatchConfigs(poolId);
    const data = read();

    const ids = rows
      .filter(r=>String(r.lag_no)!==String(currentLagNo))
      .map(r=>String(r.id));

    return data.lineups
      .filter(l=>l.person_type==="player" && ids.includes(String(l.match_config_id)))
      .map(l=>l.person_id);
  }

  // ---------- SHIFT SCHEMA ----------

  async function saveShiftSchema(poolId,lagNo,matchNo,shifts){
    const data = read();

    data.shift_schemas = data.shift_schemas.filter(s=>
      !(String(s.pool_id)===String(poolId)&&
        String(s.lag_no)===String(lagNo)&&
        String(s.match_no)===String(matchNo))
    );

    shifts.forEach((s,i)=>{
      data.shift_schemas.push({
        id:uid(),
        pool_id:poolId,
        lag_no:lagNo,
        match_no:matchNo,
        shift_no:i+1,
        period_no:s.period_no,
        time_left:s.time_left,
        players_json:s.players,
        done:false
      });
    });

    write(data);
  }

  async function listShiftSchema(poolId,lagNo,matchNo){
    const data = read();
    return data.shift_schemas
      .filter(s=>
        String(s.pool_id)===String(poolId)&&
        String(s.lag_no)===String(lagNo)&&
        String(s.match_no)===String(matchNo)
      )
      .sort((a,b)=>a.shift_no-b.shift_no);
  }

  async function deleteShiftSchema(poolId,lagNo,matchNo){
    const data = read();
    data.shift_schemas = data.shift_schemas.filter(s=>
      !(String(s.pool_id)===String(poolId)&&
        String(s.lag_no)===String(lagNo)&&
        String(s.match_no)===String(matchNo))
    );
    write(data);
  }

  async function setShiftDone(poolId,lagNo,matchNo,shiftNo,done){
    const data = read();
    const row = data.shift_schemas.find(s=>
      String(s.pool_id)===String(poolId)&&
      String(s.lag_no)===String(lagNo)&&
      String(s.match_no)===String(matchNo)&&
      String(s.shift_no)===String(shiftNo)
    );
    if(row) row.done=done;
    write(data);
  }

  async function listGoalieStats(){
    return read().goalie_stats;
  }

  async function listPlayerCoachMap(){
    return read().player_coach_map;
  }

  async function subscribeTruppen(){
    return {unsubscribe(){}};
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
    getLineup,
    saveLineup,
    listUsedPlayersInPool,
    saveShiftSchema,
    listShiftSchema,
    deleteShiftSchema,
    setShiftDone,
    listGoalieStats,
    listPlayerCoachMap,
    subscribeTruppen
  };
})();
