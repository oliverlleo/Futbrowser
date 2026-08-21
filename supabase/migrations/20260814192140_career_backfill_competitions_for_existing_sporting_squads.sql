DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT st.player_id
    FROM public.player_career_state st
    JOIN public.base_clubs c ON c.id=st.club_id
    WHERE c.squad_level IN('u15','u17','u18','u20','first_team')
  LOOP
    PERFORM private.ensure_competition_world(r.player_id);
    PERFORM private.sync_competition_next_match(r.player_id);
  END LOOP;
END
$$;