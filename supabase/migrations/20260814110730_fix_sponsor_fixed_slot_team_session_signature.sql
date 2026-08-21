CREATE OR REPLACE FUNCTION private.sponsor_fixed_slot(p_player_id uuid, p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  st record;
  cl record;
  co record;
  d date;
  per integer;
BEGIN
  SELECT * INTO st FROM public.player_career_state WHERE player_id=p_player_id;
  SELECT * INTO cl FROM public.base_clubs WHERE id=st.club_id;
  SELECT * INTO co FROM public.base_coaches WHERE id=coalesce(st.coach_id,cl.coach_id);

  FOR d IN
    SELECT x::date FROM generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') x
  LOOP
    IF st.next_match_date=d OR EXISTS(
      SELECT 1 FROM public.career_competition_fixtures f
      WHERE f.match_date=d
        AND (f.home_club_id=st.club_id OR f.away_club_id=st.club_id)
        AND coalesce(f.status,'scheduled') NOT IN('cancelled','void')
    ) THEN CONTINUE; END IF;

    FOR per IN 0..2 LOOP
      IF d=st.career_date AND per<st.day_period THEN CONTINUE; END IF;
      IF private.team_session_for_period(d,per::smallint,co.profile::text) IS NOT NULL THEN CONTINUE; END IF;
      IF EXISTS(
        SELECT 1 FROM public.player_sponsor_deliverables sd
        WHERE sd.player_id=p_player_id
          AND sd.status='pending'
          AND sd.scheduled_on=d
          AND sd.scheduled_period=per::smallint
      ) THEN CONTINUE; END IF;
      RETURN jsonb_build_object('date',d,'period',per);
    END LOOP;
  END LOOP;

  RETURN NULL;
END
$function$;
