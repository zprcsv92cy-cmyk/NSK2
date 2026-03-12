window.NSK2App = (() => {
  function byId(id){ return document.getElementById(id); }
  function esc(s){ return String(s ?? '').replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }
  function setText(id,text){ const el=byId(id); if(el) el.textContent=text||''; }

  const saveTimers = {};
  let truppenRealtime = null;
  let globalClicksBound = false;
  let laguppstallningBound = false;
  let lineupAutosaveTimer = null;
  let lineupAutosaveRunning = false;

  async function init(){
    if(window.Auth?.init) await Auth.init();
    bindGlobalClicks();
    await initStartsidaPage();
    await initSkapaPoolspelPage();
    await initLaguppstallningPage();
    await initBytesschemaPage();
    await initTruppenPage();
    await initGoalieStatsPage();
  }

  function bindGlobalClicks(){
    if(globalClicksBound) return;
    globalClicksBound = true;

    document.addEventListener('click', async e => {
      const t = e.target;
      if(!(t instanceof HTMLElement)) return;
      try{
        if(t.dataset.editPool){
          sessionStorage.setItem('nsk2_edit_pool_id', t.dataset.editPool);
          window.location.href = '../skapapoolspel/';
          return;
        }
        if(t.dataset.deletePool){
          if(!window.confirm('Ta bort poolspelet?')) return;
          await DB.deletePool(t.dataset.deletePool);
          window.location.reload();
          return;
        }
        if(t.dataset.poolId && t.dataset.lagNo){
          sessionStorage.setItem('nsk2_pool_id', t.dataset.poolId || '');
          sessionStorage.setItem('nsk2_lag_nr', t.dataset.lagNo || '1');
          window.location.href = '../laguppstallning/';
          return;
        }
        if(t.dataset.deletePlayer){ await deletePlayer(t.dataset.deletePlayer); return; }
        if(t.dataset.deleteCoach){ await deleteCoach(t.dataset.deleteCoach); return; }
        if(t.dataset.randomGoalie){ await randomizeGoalie(); return; }
        if(t.dataset.shiftToggle){ await toggleShiftDone(t.dataset.shiftToggle); return; }
      }catch(err){ setText('appError', err.message || String(err)); }
    });

    document.addEventListener('input', e => {
      const t=e.target;
      if(!(t instanceof HTMLElement)) return;
      if(t.dataset.inlinePlayer) queueInlinePlayerSave(t.dataset.inlinePlayer, t.value);
      if(t.dataset.inlineCoach) queueInlineCoachSave(t.dataset.inlineCoach, t.value);
      if(t.id==='lineupOpponent') queueLineupAutosave(700);
    });

    document.addEventListener('blur', async e => {
      const t=e.target;
      if(!(t instanceof HTMLElement)) return;
      try{
        if(t.dataset.inlinePlayer) await flushInlinePlayerSave(t.dataset.inlinePlayer, t.value);
        if(t.dataset.inlineCoach) await flushInlineCoachSave(t.dataset.inlineCoach, t.value);
      }catch(err){ setText('appError', err.message || String(err)); }
    }, true);
  }

  async function initStartsidaPage(){
    const box=byId('savedPoolsList');
    if(!box) return;
    try{
      const pools=await DB.listPools();
      if(!pools.length){ box.innerHTML='<div class="listrow">Inga sparade poolspel ännu.</div>'; return; }
      box.innerHTML = pools.map(p=>{
        const teams = parseInt(p.teams || '2',10) || 2;
        const lagButtons = Array.from({length:teams},(_,i)=>`<button class="team-btn" type="button" data-pool-id="${p.id}" data-lag-no="${i+1}">Lag ${i+1}</button>`).join('');
        return `<article class="pool-item">
          <div class="pool-top">
            <div><div class="pool-title">${esc(p.place || 'Ort')} • ${esc(p.pool_date || 'Datum')}</div><div class="pool-meta">${esc(p.title || 'Poolspel')}</div></div>
            <div class="status-badge">${esc(p.status || 'Aktiv')}</div>
          </div>
          <div class="row-actions pool-actions">
            <button class="row-btn" data-edit-pool="${p.id}">Redigera</button>
            <button class="row-btn danger" data-delete-pool="${p.id}">Ta bort</button>
          </div>
          <div class="pool-lineup-block"><div class="pool-lineup-title">Laguppställning</div><div class="team-buttons">${lagButtons}</div></div>
        </article>`;
      }).join('');
    }catch(err){ setText('appError', err.message || String(err)); }
  }

  async function initSkapaPoolspelPage(){
    const saveBtn=byId('savePool');
    const teamsSel=byId('teams');
    if(!saveBtn || !teamsSel) return;
    const editId=sessionStorage.getItem('nsk2_edit_pool_id');
    if(editId){
      try{
        const pool=await DB.getPool(editId);
        if(byId('poolPlace')) byId('poolPlace').value=pool.place || '';
        if(byId('poolDate')) byId('poolDate').value=pool.pool_date || '';
        if(byId('teams')) byId('teams').value=String(pool.teams || 2);
        if(byId('matches')) byId('matches').value=String(pool.matches || 4);
        if(byId('players')) byId('players').value=String(pool.players_on_field || 3);
        if(byId('periods')) byId('periods').value=String(pool.periods || 1);
        if(byId('periodTime')) byId('periodTime').value=String(pool.period_time || 15);
        if(byId('subTime')) byId('subTime').value=String(pool.sub_time || 90);
      }catch(err){ setText('appError', err.message || String(err)); }
    }else{
      if(byId('poolPlace')) byId('poolPlace').value='';
      if(byId('poolDate')) byId('poolDate').value='';
    }
    renderLaguppstallningButtons();
    teamsSel.addEventListener('change', renderLaguppstallningButtons);
    saveBtn.addEventListener('click', savePool);
  }

  function renderLaguppstallningButtons(){
    const teams=parseInt(byId('teams')?.value || '2',10);
    const box=byId('lagButtons');
    if(!box) return;
    box.innerHTML='';
    for(let i=1;i<=teams;i++){
      const btn=document.createElement('button');
      btn.className='team-btn';
      btn.type='button';
      btn.textContent=`Lag ${i}`;
      btn.addEventListener('click', ()=>{
        sessionStorage.removeItem('nsk2_pool_id');
        sessionStorage.setItem('nsk2_lag_nr', String(i));
        window.location.href='../laguppstallning/';
      });
      box.appendChild(btn);
    }
  }

  async function savePool(){
    try{
      const payload={
        title:'Poolspel',
        place:byId('poolPlace')?.value?.trim() || '',
        pool_date:byId('poolDate')?.value || null,
        status:'Aktiv',
        teams:parseInt(byId('teams')?.value || '2',10),
        matches:parseInt(byId('matches')?.value || '4',10),
        players_on_field:parseInt(byId('players')?.value || '3',10),
        periods:parseInt(byId('periods')?.value || '1',10),
        period_time:parseInt(byId('periodTime')?.value || '15',10),
        sub_time:parseInt(byId('subTime')?.value || '90',10)
      };
      const editId=sessionStorage.getItem('nsk2_edit_pool_id');
      let pool;
      if(editId){
        pool=await DB.updatePool(editId,payload);
        sessionStorage.removeItem('nsk2_edit_pool_id');
      }else{
        pool=await DB.addPool(payload);
        if(byId('poolPlace')) byId('poolPlace').value='';
        if(byId('poolDate')) byId('poolDate').value='';
      }
      sessionStorage.setItem('nsk2_pool_id', pool.id);
      setText('poolMsg','Poolspel sparat');
      window.location.href='../startsida/';
    }catch(err){ setText('appError', err.message || String(err)); }
  }

  async function initLaguppstallningPage(){
    const teamButtonsBox=byId('laguppstallningTeamButtons');
    const matchSelect=byId('lineupMatch');
    const lineupBox=byId('lineupSelectors');
    const coachSelect=byId('lineupCoach');
    if(!teamButtonsBox || !matchSelect || !lineupBox || !coachSelect) return;
    try{
      const poolId=sessionStorage.getItem('nsk2_pool_id');
      let teams=2, matches=4, playersOnField=3;
      if(poolId){
        const pool=await DB.getPool(poolId);
        teams=parseInt(pool?.teams || '2',10) || 2;
        matches=parseInt(pool?.matches || '4',10) || 4;
        playersOnField=parseInt(pool?.players_on_field || '3',10) || 3;
      }
      renderLaguppstallningTeamButtons(teams);
      renderLaguppstallningMatchOptions(matches);
      renderMatchButtons(matches);
      renderPlayerCountOptions(playersOnField);
      await renderCoachOptions();
      await renderLineupSelectors();
      const savedLag=sessionStorage.getItem('nsk2_lag_nr') || '1';
      setActiveLagButton(savedLag);
      setActiveMatchButton(byId('lineupMatch')?.value || '1');
      if(!laguppstallningBound){
        laguppstallningBound=true;
        matchSelect.addEventListener('change', async ()=>{
          await autoSaveLineup(true);
          setActiveMatchButton(matchSelect.value);
          await fillLaguppstallningFormFromSelection();
        });
        byId('lineupPlayerCount')?.addEventListener('change', async ()=>{
          updateVisiblePlayers();
          syncCurrentSelectionVisibility();
          await updateCoachEnabledState();
          queueLineupAutosave();
        });
        coachSelect.addEventListener('change', ()=>queueLineupAutosave());
      }
      updateVisiblePlayers();
      syncCurrentSelectionVisibility();
      await updateCoachEnabledState();
      await fillLaguppstallningFormFromSelection();
    }catch(err){ setText('appError', err.message || String(err)); }
  }

  function renderLaguppstallningTeamButtons(teams){
    const box=byId('laguppstallningTeamButtons');
    if(!box) return;
    box.innerHTML='';
    for(let i=1;i<=teams;i++){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='team-btn lag-team-btn';
      btn.textContent=`Lag ${i}`;
      btn.dataset.lagTeam=String(i);
      btn.addEventListener('click', async ()=>{
        await autoSaveLineup(true);
        sessionStorage.setItem('nsk2_lag_nr', String(i));
        setActiveLagButton(String(i));
        await fillLaguppstallningFormFromSelection();
      });
      box.appendChild(btn);
    }
  }

  function setActiveLagButton(lagNo){
    document.querySelectorAll('.lag-team-btn').forEach(btn=>{
      if(btn.dataset.lagTeam===String(lagNo)) btn.classList.add('active-team-btn');
      else btn.classList.remove('active-team-btn');
    });
  }

  function renderLaguppstallningMatchOptions(matches){
    const sel=byId('lineupMatch');
    if(!sel) return;
    sel.innerHTML='';
    for(let i=1;i<=matches;i++){
      const opt=document.createElement('option');
      opt.value=String(i); opt.textContent=`Match ${i}`; sel.appendChild(opt);
    }
  }

  function renderMatchButtons(matches){
    const box=byId('matchButtons');
    const hiddenSelect=byId('lineupMatch');
    if(!box || !hiddenSelect) return;
    box.innerHTML='';
    for(let i=1;i<=matches;i++){
      const btn=document.createElement('button');
      btn.type='button'; btn.className='team-btn match-btn'; btn.textContent=`Match ${i}`; btn.dataset.matchNo=String(i);
      btn.addEventListener('click', async ()=>{
        await autoSaveLineup(true);
        hiddenSelect.value=String(i);
        setActiveMatchButton(String(i));
        await fillLaguppstallningFormFromSelection();
      });
      box.appendChild(btn);
    }
  }

  function setActiveMatchButton(matchNo){
    document.querySelectorAll('.match-btn').forEach(btn=>{
      if(btn.dataset.matchNo===String(matchNo)) btn.classList.add('active-team-btn');
      else btn.classList.remove('active-team-btn');
    });
  }

  function renderPlayerCountOptions(defaultCount){
    const sel=byId('lineupPlayerCount');
    if(!sel) return;
    sel.innerHTML='';
    for(let i=1;i<=25;i++){
      const opt=document.createElement('option');
      opt.value=String(i); opt.textContent=String(i); if(i===Number(defaultCount)) opt.selected=true; sel.appendChild(opt);
    }
  }

  async function renderCoachOptions(){
    const coachSelect=byId('lineupCoach');
    if(!coachSelect) return;
    const coaches=await DB.listCoaches();
    coachSelect.innerHTML=coaches.map(c=>`<option value="${c.id}">${esc(c.full_name)}</option>`).join('');
  }

  async function getUsedPlayersInOtherTeams(poolId, currentLagNo){
    const usedIds=await DB.listUsedPlayersInPool(poolId, currentLagNo);
    return new Set((usedIds || []).map(String));
  }

  async function getEffectiveMatchSource(poolId, lagNo, matchNo){
    if(!poolId) return { row:null, lineup:[] };
    let row=await DB.getPoolTeamMatchConfig(poolId, lagNo, matchNo);
    let sourceRow=row;
    if(!sourceRow && String(matchNo)!=='1') sourceRow=await DB.getPoolTeamMatchConfig(poolId, lagNo, 1);
    let lineup=[];
    if(sourceRow?.id) lineup=await DB.getLineup(sourceRow.id);
    return { row:sourceRow, lineup };
  }

  async function renderLineupSelectors(){
    const box=byId('lineupSelectors');
    if(!box) return;
    try{
      const poolId=sessionStorage.getItem('nsk2_pool_id');
      const lagNo=sessionStorage.getItem('nsk2_lag_nr') || '1';
      const currentMatchNo=byId('lineupMatch')?.value || '1';
      const players=await DB.listPlayers();
      const usedSet=poolId ? await getUsedPlayersInOtherTeams(poolId, lagNo) : new Set();
      const source=await getEffectiveMatchSource(poolId, lagNo, currentMatchNo);
      const ownSet=new Set();
      if(source.row?.goalie_player_id) ownSet.add(String(source.row.goalie_player_id));
      (source.lineup || []).filter(x=>x.person_type==='player').forEach(x=>ownSet.add(String(x.person_id)));
      const playerOptions=['<option value="">Välj spelare</option>'].concat(
        players.filter(p=>!usedSet.has(String(p.id)) || ownSet.has(String(p.id))).map(p=>`<option value="${p.id}">${esc(p.full_name)}</option>`)
      ).join('');
      let html=`<div class="goalie-row"><div class="goalie-col"><label for="lineupGoalie">Målvakt</label><select id="lineupGoalie">${playerOptions}</select></div><div class="goalie-col goalie-random-col"><label>&nbsp;</label><button type="button" class="row-btn" data-random-goalie="1">Slumpa</button></div></div>`;
      for(let i=1;i<=25;i++) html+=`<label for="lineupPlayer${i}" data-player-label="${i}">Spelare ${i}</label><select id="lineupPlayer${i}" data-player-select="${i}">${playerOptions}</select>`;
      box.innerHTML=html;
      attachLineupFieldHandlers();
    }catch(err){ setText('appError', err.message || String(err)); }
  }

  function attachLineupFieldHandlers(){
    const goalie=byId('lineupGoalie');
    if(goalie && !goalie.dataset.bound){
      goalie.dataset.bound='1';
      goalie.addEventListener('change', async ()=>{
        syncCurrentSelectionVisibility();
        await updateCoachEnabledState();
        queueLineupAutosave();
      });
    }
    for(let i=1;i<=25;i++){
      const el=byId(`lineupPlayer${i}`);
      if(el && !el.dataset.bound){
        el.dataset.bound='1';
        el.addEventListener('change', async ()=>{
          syncCurrentSelectionVisibility();
          await updateCoachEnabledState();
          queueLineupAutosave();
        });
      }
    }
    const start=byId('lineupStartTime');
    if(start && !start.dataset.bound){ start.dataset.bound='1'; start.addEventListener('change', ()=>queueLineupAutosave()); }
    const opp=byId('lineupOpponent');
    if(opp && !opp.dataset.bound){ opp.dataset.bound='1'; opp.addEventListener('input', ()=>queueLineupAutosave(700)); }
    const plan=byId('lineupPlan');
    if(plan && !plan.dataset.bound){ plan.dataset.bound='1'; plan.addEventListener('change', ()=>queueLineupAutosave()); }
  }

  function getSelectedVisiblePlayerIds(){
    const count=parseInt(byId('lineupPlayerCount')?.value || '1',10);
    const ids=[];
    for(let i=1;i<=count;i++){
      const val=byId(`lineupPlayer${i}`)?.value || '';
      if(val) ids.push(String(val));
    }
    return ids;
  }

  function syncCurrentSelectionVisibility(){
    const goalieId=String(byId('lineupGoalie')?.value || '');
    const selectedPlayers=getSelectedVisiblePlayerIds();
    const goalieSel=byId('lineupGoalie');
    if(goalieSel){
      Array.from(goalieSel.options).forEach(opt=>{
        if(!opt.value) return;
        const hide=selectedPlayers.includes(String(opt.value));
        opt.hidden=hide; opt.disabled=hide;
      });
      if(goalieId && selectedPlayers.includes(goalieId)) goalieSel.value='';
    }
    const count=parseInt(byId('lineupPlayerCount')?.value || '1',10);
    for(let i=1;i<=count;i++){
      const sel=byId(`lineupPlayer${i}`);
      if(!sel) continue;
      const otherPlayers=selectedPlayers.filter(id=>id!==String(sel.value || ''));
      Array.from(sel.options).forEach(opt=>{
        if(!opt.value) return;
        const hide=(goalieId && String(opt.value)===goalieId) || otherPlayers.includes(String(opt.value));
        opt.hidden=hide; opt.disabled=hide;
      });
      if((goalieId && sel.value===goalieId) || otherPlayers.includes(String(sel.value))) sel.value='';
    }
  }

  function updateVisiblePlayers(){
    const count=parseInt(byId('lineupPlayerCount')?.value || '1',10);
    for(let i=1;i<=25;i++){
      const label=document.querySelector(`[data-player-label="${i}"]`);
      const field=byId(`lineupPlayer${i}`);
      if(!field) continue;
      if(i<=count){ field.style.display=''; if(label) label.style.display=''; }
      else { field.style.display='none'; if(label) label.style.display='none'; field.value=''; }
    }
    syncCurrentSelectionVisibility();
  }

  async function updateCoachEnabledState(){
    const coachSelect=byId('lineupCoach');
    if(!coachSelect) return;
    const players=await DB.listPlayers();
    const coaches=await DB.listCoaches();
    const mappings=await DB.listPlayerCoachMap();
    const playerMap={}; players.forEach(p=>{ playerMap[String(p.id)] = p.full_name; });
    const coachMap={}; coaches.forEach(c=>{ coachMap[c.full_name] = String(c.id); });
    const map={}; mappings.forEach(m=>{ map[m.player_name] = m.coach_name; });

    const goalie=byId('lineupGoalie')?.value || '';
    const count=parseInt(byId('lineupPlayerCount')?.value || '1',10);
    const ids=[];
    if(goalie) ids.push(goalie);
    for(let i=1;i<=count;i++){
      const v=byId(`lineupPlayer${i}`)?.value || '';
      if(v) ids.push(v);
    }

    const autoCoachIds=new Set();
    ids.forEach(pid=>{
      const playerName=playerMap[String(pid)];
      const coachName=map[playerName];
      if(coachName && coachMap[coachName]) autoCoachIds.add(coachMap[coachName]);
    });

    Array.from(coachSelect.options).forEach(opt=>{
      if(autoCoachIds.has(String(opt.value))) opt.selected=true;
    });

    const fullyComplete=!!goalie && getSelectedVisiblePlayerIds().length===count;
    coachSelect.disabled=!fullyComplete;
  }

  async function randomizeGoalie(){
    const selectedPlayerIds=getSelectedVisiblePlayerIds();
    const players=await DB.listPlayers();
    const goalieStats=await DB.listGoalieStats();
    const statCount={};
    players.forEach(p=>{ statCount[p.full_name]=0; });
    goalieStats.forEach(g=>{ const n=String(g.goalie_name || ''); statCount[n]=(statCount[n] || 0)+1; });
    const candidates=players.filter(p=>!selectedPlayerIds.includes(String(p.id)));
    if(!candidates.length){ setText('lineupMsg','Ingen spelare finns kvar att slumpa som målvakt.'); return; }
    let min=Infinity; candidates.forEach(p=>{ const c=statCount[p.full_name] ?? 0; if(c<min) min=c; });
    const lowest=candidates.filter(p=>(statCount[p.full_name] ?? 0)===min);
    const chosen=lowest.length===1 ? lowest[0] : lowest[Math.floor(Math.random()*lowest.length)];
    const goalieSel=byId('lineupGoalie'); if(goalieSel) goalieSel.value=String(chosen.id);
    syncCurrentSelectionVisibility();
    await updateCoachEnabledState();
    await propagateGoalieForward(String(chosen.id));
    queueLineupAutosave();
    setText('lineupMsg', `Målvakt slumpad: ${chosen.full_name}`);
  }

  async function propagateGoalieForward(goalieId){
    const poolId=sessionStorage.getItem('nsk2_pool_id') || '';
    const lagNo=sessionStorage.getItem('nsk2_lag_nr') || '1';
    const matchNo=parseInt(byId('lineupMatch')?.value || '1',10);
    if(!poolId) return;
    const pool=await DB.getPool(poolId);
    const matches=parseInt(pool.matches || 4,10);
    for(let m=matchNo;m<=matches;m++){
      let row=await DB.getPoolTeamMatchConfig(poolId, lagNo, m);
      const source=row || (m>1 ? await DB.getPoolTeamMatchConfig(poolId, lagNo, 1) : null);
      await DB.savePoolTeamMatchConfig({
        pool_id:poolId,
        lag_no:parseInt(lagNo,10),
        match_no:m,
        start_time:row?.start_time || null,
        opponent:row?.opponent || '',
        plan:row?.plan || 'Plan 1',
        player_count:row?.player_count ?? source?.player_count ?? parseInt(pool.players_on_field || 3,10),
        goalie_player_id:goalieId || null
      });
      await regenerateShiftSchemaFor(poolId, lagNo, m);
    }
  }

  async function fillLaguppstallningFormFromSelection(){
    const lagNo=sessionStorage.getItem('nsk2_lag_nr') || '1';
    const matchNo=byId('lineupMatch')?.value || '1';
    const poolId=sessionStorage.getItem('nsk2_pool_id') || '';
    const title=byId('laguppstallningTitle');
    if(title) title.textContent=`Lag ${lagNo} • Match ${matchNo}`;

    if(!poolId){
      await renderCoachOptions(); await renderLineupSelectors();
      if(byId('lineupStartTime')) byId('lineupStartTime').value='';
      if(byId('lineupOpponent')) byId('lineupOpponent').value='';
      if(byId('lineupPlan')) byId('lineupPlan').value='Plan 1';
      if(byId('lineupPlayerCount')) byId('lineupPlayerCount').value='3';
      const coachSelect=byId('lineupCoach'); if(coachSelect) Array.from(coachSelect.options).forEach(opt=>{ opt.selected=false; });
      const goalie=byId('lineupGoalie'); if(goalie) goalie.value='';
      for(let i=1;i<=25;i++){ const el=byId(`lineupPlayer${i}`); if(el) el.value=''; }
      updateVisiblePlayers();
      await updateCoachEnabledState();
      return;
    }

    try{
      const source=await getEffectiveMatchSource(poolId, lagNo, matchNo);
      const row=source.row;
      await renderCoachOptions();
      await renderLineupSelectors();
      if(byId('lineupStartTime')) byId('lineupStartTime').value=row?.start_time || '';
      if(byId('lineupOpponent')) byId('lineupOpponent').value=row?.opponent || '';
      if(byId('lineupPlan')) byId('lineupPlan').value=row?.plan || 'Plan 1';
      if(byId('lineupPlayerCount')) byId('lineupPlayerCount').value=String(row?.player_count || '3');
      updateVisiblePlayers();
      setActiveMatchButton(matchNo);
      if(byId('lineupGoalie')) byId('lineupGoalie').value=row?.goalie_player_id || '';
      const playerIds=(source.lineup || []).filter(x=>x.person_type==='player').sort((a,b)=>(a.sort_order || 0)-(b.sort_order || 0)).map(x=>String(x.person_id));
      const coachIds=(source.lineup || []).filter(x=>x.person_type==='coach').sort((a,b)=>(a.sort_order || 0)-(b.sort_order || 0)).map(x=>String(x.person_id));
      const coachSelect=byId('lineupCoach');
      if(coachSelect){ Array.from(coachSelect.options).forEach(opt=>{ opt.selected=coachIds.includes(String(opt.value)); }); }
      for(let i=1;i<=25;i++){ const el=byId(`lineupPlayer${i}`); if(el) el.value=playerIds[i-1] || ''; }
      syncCurrentSelectionVisibility();
      await updateCoachEnabledState();
    }catch(err){ setText('appError', err.message || String(err)); }
  }

  async function validateUniquePlayersAcrossPool(poolId, lagNo, matchNo, startTime, goalieId, playerIds){
    const rows=await DB.listPoolTeamMatchConfigs(poolId);
    const currentMatchNo=String(matchNo);
    const currentLagNo=String(lagNo);
    const currentStart=String(startTime || '');
    for(const row of rows){
      const sameLag=String(row.lag_no)===currentLagNo;
      const sameMatch=String(row.match_no)===currentMatchNo;
      if(sameLag && sameMatch) continue;
      const lineup=row.id ? await DB.getLineup(row.id) : [];
      const otherPlayers=lineup.filter(x=>x.person_type==='player').map(x=>String(x.person_id));
      if(!sameLag){
        for(const pid of playerIds){ if(otherPlayers.includes(String(pid))) return 'En spelare finns redan i ett annat lag i poolspelet.'; }
      }
      if(!sameLag && goalieId && String(row.goalie_player_id || '')===String(goalieId)){
        const otherStart=String(row.start_time || '');
        if(!currentStart || !otherStart){ if(sameMatch) return 'Målvakten kan inte stå i samma matchnummer i två lag när starttid saknas.'; }
        else if(currentStart===otherStart) return 'Målvakten har redan en match med samma starttid i ett annat lag.';
      }
    }
    return '';
  }

  function queueLineupAutosave(delay=500){
    clearTimeout(lineupAutosaveTimer);
    lineupAutosaveTimer=setTimeout(()=>{ autoSaveLineup(false); }, delay);
  }

  async function autoSaveLineup(force){
    const poolId=sessionStorage.getItem('nsk2_pool_id') || '';
    if(!poolId || lineupAutosaveRunning) return;
    const lagNo=sessionStorage.getItem('nsk2_lag_nr') || '1';
    const matchNo=byId('lineupMatch')?.value || '1';
    const goalie=byId('lineupGoalie')?.value || '';
    const playerCount=parseInt(byId('lineupPlayerCount')?.value || '1',10);
    const selectedPlayers=[];
    for(let i=1;i<=playerCount;i++){
      const val=byId(`lineupPlayer${i}`)?.value || '';
      if(!val) continue;
      if(goalie && val===goalie){ if(force) setText('lineupMsg','Målvakt kan inte vara samma som spelare.'); return; }
      if(selectedPlayers.includes(val)){ if(force) setText('lineupMsg','En spelare kan bara väljas en gång.'); return; }
      selectedPlayers.push(val);
    }
    if(!goalie && !selectedPlayers.length && !(byId('lineupStartTime')?.value || '') && !(byId('lineupOpponent')?.value || '')) return;
    const poolConflict=await validateUniquePlayersAcrossPool(poolId, lagNo, matchNo, byId('lineupStartTime')?.value || '', goalie, selectedPlayers);
    if(poolConflict){ if(force) setText('lineupMsg', poolConflict); return; }
    lineupAutosaveRunning=true;
    try{
      await updateCoachEnabledState();
      const coachSelect=byId('lineupCoach');
      const coachIds=coachSelect ? Array.from(coachSelect.selectedOptions).map(o=>o.value).filter(Boolean) : [];
      const matchRow=await DB.savePoolTeamMatchConfig({
        pool_id:poolId,
        lag_no:parseInt(lagNo,10),
        match_no:parseInt(matchNo,10),
        start_time:byId('lineupStartTime')?.value || null,
        opponent:byId('lineupOpponent')?.value?.trim() || '',
        plan:byId('lineupPlan')?.value || 'Plan 1',
        player_count:playerCount,
        goalie_player_id:goalie || null
      });
      await DB.saveLineup(matchRow.id, selectedPlayers, coachIds);
      await regenerateShiftSchemaFor(poolId, lagNo, matchNo);
      setText('lineupMsg','Ändringar sparade automatiskt.');
    }catch(err){ setText('appError', err.message || String(err)); }
    finally{ lineupAutosaveRunning=false; }
  }

  async function regenerateShiftSchemaFor(poolId, lagNo, matchNo){
    const pool=await DB.getPool(poolId);
    let row=await DB.getPoolTeamMatchConfig(poolId, lagNo, matchNo);
    if(!row && String(matchNo)!=='1') row=await DB.getPoolTeamMatchConfig(poolId, lagNo, 1);
    if(!row?.id){ await DB.deleteShiftSchema(poolId, lagNo, matchNo); return []; }
    const lineup=await DB.getLineup(row.id);
    const playerIds=lineup.filter(x=>x.person_type==='player').sort((a,b)=>(a.sort_order || 0)-(b.sort_order || 0)).map(x=>String(x.person_id));
    if(!playerIds.length){ await DB.deleteShiftSchema(poolId, lagNo, matchNo); return []; }
    const shifts=buildShiftSchedule({
      matchNo:parseInt(matchNo,10),
      playerIds,
      playersOnField:parseInt(row.player_count || pool.players_on_field || 3,10),
      periods:parseInt(pool.periods || 1,10),
      periodTime:parseInt(pool.period_time || 15,10),
      subTime:parseInt(pool.sub_time || 90,10)
    });
    await DB.saveShiftSchema(poolId, lagNo, matchNo, shifts);
    return shifts;
  }

  async function initBytesschemaPage(){
    const teamBox=byId('shiftTeamButtons');
    const matchBox=byId('shiftMatchButtons');
    const matchSelect=byId('shiftMatch');
    const genBtn=byId('generateShiftBtn');
    if(!teamBox || !matchBox || !matchSelect || !genBtn) return;
    try{
      const poolId=sessionStorage.getItem('nsk2_pool_id');
      if(!poolId){ setText('shiftMsg','Välj först ett poolspel från startsidan.'); return; }
      const pool=await DB.getPool(poolId);
      const teams=parseInt(pool?.teams || '2',10) || 2;
      const matches=parseInt(pool?.matches || '4',10) || 4;
      renderShiftTeamButtons(teams);
      renderShiftMatchButtons(matches);
      renderShiftMatchOptions(matches);
      const lagNo=sessionStorage.getItem('nsk2_lag_nr') || '1';
      setActiveShiftTeamButton(lagNo);
      setActiveShiftMatchButton(matchSelect.value || '1');
      genBtn.addEventListener('click', async ()=>{ await generateAndRenderShiftSchema(); });
      await renderShiftSchema();
    }catch(err){ setText('appError', err.message || String(err)); }
  }

  function renderShiftTeamButtons(teams){
    const box=byId('shiftTeamButtons'); if(!box) return; box.innerHTML='';
    for(let i=1;i<=teams;i++){
      const btn=document.createElement('button'); btn.type='button'; btn.className='team-btn lag-team-btn'; btn.textContent=`Lag ${i}`; btn.dataset.shiftLag=String(i);
      btn.addEventListener('click', async ()=>{ sessionStorage.setItem('nsk2_lag_nr', String(i)); setActiveShiftTeamButton(String(i)); await renderShiftSchema(); });
      box.appendChild(btn);
    }
  }

  function setActiveShiftTeamButton(lagNo){
    document.querySelectorAll('[data-shift-lag]').forEach(btn=>{ if(btn.dataset.shiftLag===String(lagNo)) btn.classList.add('active-team-btn'); else btn.classList.remove('active-team-btn'); });
  }

  function renderShiftMatchButtons(matches){
    const box=byId('shiftMatchButtons'); if(!box) return; box.innerHTML='';
    for(let i=1;i<=matches;i++){
      const btn=document.createElement('button'); btn.type='button'; btn.className='team-btn match-btn'; btn.textContent=`Match ${i}`; btn.dataset.shiftMatch=String(i);
      btn.addEventListener('click', async ()=>{ const sel=byId('shiftMatch'); if(sel) sel.value=String(i); setActiveShiftMatchButton(String(i)); await renderShiftSchema(); });
      box.appendChild(btn);
    }
  }

  function renderShiftMatchOptions(matches){
    const sel=byId('shiftMatch'); if(!sel) return; sel.innerHTML='';
    for(let i=1;i<=matches;i++){ const opt=document.createElement('option'); opt.value=String(i); opt.textContent=`Match ${i}`; sel.appendChild(opt); }
  }

  function setActiveShiftMatchButton(matchNo){
    document.querySelectorAll('[data-shift-match]').forEach(btn=>{ if(btn.dataset.shiftMatch===String(matchNo)) btn.classList.add('active-team-btn'); else btn.classList.remove('active-team-btn'); });
  }

  async function toggleShiftDone(token){
    const [poolId, lagNo, matchNo, shiftNo] = token.split('|');
    const el=document.querySelector(`[data-shift-toggle="${token}"]`);
    const done=!(el?.classList.contains('done'));
    await DB.setShiftDone(poolId, lagNo, matchNo, shiftNo, done);
    if(el) el.classList.toggle('done', done);
  }

  async function generateAndRenderShiftSchema(){
    const poolId=sessionStorage.getItem('nsk2_pool_id');
    const lagNo=sessionStorage.getItem('nsk2_lag_nr') || '1';
    const matchNo=byId('shiftMatch')?.value || '1';
    if(!poolId){ setText('shiftMsg','Välj ett poolspel först.'); return; }
    const shifts=await regenerateShiftSchemaFor(poolId, lagNo, matchNo);
    if(!shifts.length){ setText('shiftMsg','Spara eller fyll i laguppställning först.'); return; }
    setText('shiftMsg','Bytesschema skapat/uppdaterat.');
    await renderShiftSchema();
  }

  function buildShiftSchedule({ matchNo, playerIds, playersOnField, periods, periodTime, subTime }){
    const shifts=[];
    const totalSeconds=periodTime*60;
    const shiftCountPerPeriod=Math.max(1, Math.ceil(totalSeconds/subTime));
    const offset=(matchNo-1) % Math.max(1, playerIds.length);
    const rotated=playerIds.slice(offset).concat(playerIds.slice(0, offset));
    const exposure={}; playerIds.forEach((id,idx)=>{ exposure[id]=idx; });
    let lastLine=[];
    for(let period=1; period<=periods; period++){
      for(let s=0; s<shiftCountPerPeriod; s++){
        const candidates=[...rotated].sort((a,b)=>((exposure[a] + (lastLine.includes(a)?1000:0)) - (exposure[b] + (lastLine.includes(b)?1000:0))));
        const chosen=[];
        for(const pid of candidates){ if(chosen.length>=playersOnField) break; if(!chosen.includes(pid)) chosen.push(pid); }
        chosen.forEach(pid=>{ exposure[pid]+=playerIds.length+3; });
        playerIds.filter(pid=>!chosen.includes(pid)).forEach(pid=>{ exposure[pid]=Math.max(0, exposure[pid]-1); });
        lastLine=[...chosen];
        const elapsed=s*subTime; const left=Math.max(0, totalSeconds-elapsed); const mm=String(Math.floor(left/60)).padStart(2,'0'); const ss=String(left%60).padStart(2,'0');
        shifts.push({ period_no:period, time_left:`${mm}:${ss}`, players:chosen });
      }
    }
    return shifts;
  }

  async function renderShiftSchema(){
    const poolId=sessionStorage.getItem('nsk2_pool_id');
    const lagNo=sessionStorage.getItem('nsk2_lag_nr') || '1';
    const matchNo=byId('shiftMatch')?.value || '1';
    if(!poolId) return;
    const pool=await DB.getPool(poolId);
    let row=await DB.getPoolTeamMatchConfig(poolId, lagNo, matchNo);
    if(!row && String(matchNo)!=='1') row=await DB.getPoolTeamMatchConfig(poolId, lagNo, 1);
    const players=await DB.listPlayers(); const coaches=await DB.listCoaches();
    const playerMap={}; const coachMap={}; players.forEach(p=>{ playerMap[String(p.id)]=p.full_name; }); coaches.forEach(c=>{ coachMap[String(c.id)]=c.full_name; });
    const title=`Match ${matchNo} • Lag ${lagNo}`;
    setText('bytesschemaTitle', title); setText('shiftHeaderMain', title); setText('shiftStart', row?.start_time || '—'); setText('shiftDate', pool?.pool_date || '—'); setText('shiftOpponent', row?.opponent || '—'); setText('shiftPlan', row?.plan || '—');
    setText('shiftGoalieName', row?.goalie_player_id ? (playerMap[String(row.goalie_player_id)] || '—') : '—');
    let coachNames='—';
    if(row?.id){
      const lineup=await DB.getLineup(row.id);
      const ids=lineup.filter(x=>x.person_type==='coach').sort((a,b)=>(a.sort_order || 0)-(b.sort_order || 0)).map(x=>coachMap[String(x.person_id)] || '—').filter(Boolean);
      if(ids.length) coachNames=ids.join(', ');
    }
    setText('shiftCoachNames', coachNames);
    setActiveShiftTeamButton(lagNo); setActiveShiftMatchButton(matchNo);
    const rows=await DB.listShiftSchema(poolId, lagNo, matchNo);
    const wrap=byId('shiftTableWrap'); if(!wrap) return;
    if(!rows.length){ wrap.innerHTML='<div class="small">Inget bytesschema ännu. Fyll i laguppställning först.</div>'; return; }
    wrap.innerHTML=`<table class="shift-table"><thead><tr><th></th><th>#</th><th>Tid kvar</th><th>På plan</th></tr></thead><tbody>${rows.map(r=>{
      const names=(Array.isArray(r.players_json)?r.players_json:[]).map(id=>playerMap[String(id)] || '—').join('<br>');
      const token=`${poolId}|${lagNo}|${matchNo}|${r.shift_no}`;
      return `<tr><td class="check-cell"><span class="shift-check ${r.done ? 'done' : ''}" data-shift-toggle="${token}"></span></td><td>${r.shift_no}</td><td>${esc(r.time_left)}</td><td class="shift-players">${names || '—'}</td></tr>`;
    }).join('')}</tbody></table>`;
  }

  function rowHtml(item,type){
    return `<div class="person-row"><div class="person-main"><input class="inline-name-input" value="${esc(item.full_name)}" data-inline-${type}="${item.id}"></div><div class="row-actions"><button class="row-btn danger" data-delete-${type}="${item.id}">Ta bort</button></div></div>`;
  }

  async function renderPlayers(){
    const list=byId('playersList'); if(!list) return;
    const players=await DB.listPlayers();
    list.innerHTML=players.length ? players.map(p=>rowHtml(p,'player')).join('') : '<div class="muted-note">Inga spelare ännu.</div>';
  }

  async function renderCoaches(){
    const list=byId('coachesList'); if(!list) return;
    const coaches=await DB.listCoaches();
    list.innerHTML=coaches.length ? coaches.map(c=>rowHtml(c,'coach')).join('') : '<div class="muted-note">Inga tränare ännu.</div>';
  }

  function queueInlinePlayerSave(id,value){ clearTimeout(saveTimers[`p_${id}`]); saveTimers[`p_${id}`]=setTimeout(async ()=>{ await DB.updatePlayer(id, String(value || '').trim()); }, 600); }
  function queueInlineCoachSave(id,value){ clearTimeout(saveTimers[`c_${id}`]); saveTimers[`c_${id}`]=setTimeout(async ()=>{ await DB.updateCoach(id, String(value || '').trim()); }, 600); }
  async function flushInlinePlayerSave(id,value){ clearTimeout(saveTimers[`p_${id}`]); await DB.updatePlayer(id, String(value || '').trim()); }
  async function flushInlineCoachSave(id,value){ clearTimeout(saveTimers[`c_${id}`]); await DB.updateCoach(id, String(value || '').trim()); }

  async function addPlayer(){ const input=byId('playerInput'); const name=input?.value?.trim(); if(!name) return; await DB.addPlayer(name); input.value=''; await renderPlayers(); }
  async function addCoach(){ const input=byId('coachInput'); const name=input?.value?.trim(); if(!name) return; await DB.addCoach(name); input.value=''; await renderCoaches(); }
  async function deletePlayer(id){ await DB.deletePlayer(id); await renderPlayers(); }
  async function deleteCoach(id){ await DB.deleteCoach(id); await renderCoaches(); }

  async function initTruppenPage(){
    if(!byId('playersList') && !byId('coachesList')) return;
    byId('addPlayerBtn')?.addEventListener('click', addPlayer);
    byId('addCoachBtn')?.addEventListener('click', addCoach);
    await renderPlayers(); await renderCoaches();
    if(!truppenRealtime){
      truppenRealtime=await DB.subscribeTruppen(async type=>{ if(type==='players') await renderPlayers(); if(type==='coaches') await renderCoaches(); });
    }
  }

  async function initGoalieStatsPage(){
    const list=byId('goalieStatsList'); if(!list) return;
    const stats=await DB.listGoalieStats(); const grouped={};
    stats.forEach(row=>{ const name=row.goalie_name || 'Okänd'; if(!grouped[name]) grouped[name]=new Set(); grouped[name].add(row.match_id); });
    const rows=Object.entries(grouped).map(([name,set])=>({ name, count:set.size })).sort((a,b)=>b.count-a.count);
    list.innerHTML=rows.map(r=>`<div class="listrow"><strong>${esc(r.name)}</strong> — ${r.count} matcher</div>`).join('');
  }

  return { init };
})();

window.addEventListener('DOMContentLoaded', ()=>{
  window.NSK2App.init().catch(err=>{
    const el=document.getElementById('appError');
    if(el) el.textContent=err.message || String(err);
    console.error(err);
  });
});
