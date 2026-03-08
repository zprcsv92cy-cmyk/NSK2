Byt till denna scriptordning i sidorna:

<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
<script src="/NSK2/config.js"></script>
<script src="/NSK2/auth.js"></script>
<script src="/NSK2/db.js"></script>
<script src="/NSK2/app.js"></script>

db.js V2 använder riktiga tabeller:
- nsk_teams
- nsk_players
- nsk_coaches
- nsk_pools
- nsk_matches
- nsk_lineups
- nsk_lineup_players
- nsk_goalie_stats

Exempel:
const players = await DB.listPlayers();
await DB.addPlayer("Ny spelare");
const pools = await DB.listPools();

Realtime:
const channel = await DB.subscribe("nsk_players", () => {
  // ladda om listan
});
