Byt din nuvarande app.js till denna fil.

Scriptordning i varje sida:
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
<script src="/NSK2/config.js"></script>
<script src="/NSK2/auth.js"></script>
<script src="/NSK2/db.js"></script>
<script src="/NSK2/app.js"></script>

Det här app.js använder DB.*-funktioner istället för localStorage.
Det stöder:
- truppen via nsk_players / nsk_coaches
- poolspel via nsk_pools
- matchvy via nsk_matches
- bytesschema via nsk_lineups / nsk_lineup_players
- målvaktsstatistik via nsk_goalie_stats
- realtime uppdatering via DB.subscribe()
