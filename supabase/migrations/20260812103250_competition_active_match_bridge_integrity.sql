BEGIN;

CREATE OR REPLACE FUNCTION private.sync_competition_next_match(p_player uuid)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_state record;
  v_next date;
  v_has_active_match boolean;
BEGIN
  SELECT * INTO v_state
  FROM public.player_career_state
  WHERE player_id=p_player;

  IF v_state.player_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- A career can receive the competition engine while an older match-day
  -- session is already open. Do not move next_match_date underneath that
  -- active game; its existing result trigger still needs the original date
  -- to advance the career safely. The new competition calendar takes over
  -- immediately after that session is completed.
  SELECT EXISTS(
    SELECT 1
    FROM private.career_match_sessions s
    WHERE s.player_id=p_player
      AND s.match_date=v_state.career_date
      AND s.status='active'
  ) INTO v_has_active_match;

  PERFORM private.ensure_competition_world(p_player);

  IF v_has_active_match THEN
    RETURN v_state.next_match_date;
  END IF;

  SELECT private.next_career_fixture_date(p_player,v_state.career_date-1)
    INTO v_next;

  IF v_next IS NULL THEN
    PERFORM private.roll_competition_world_if_needed(p_player);
    SELECT private.next_career_fixture_date(p_player,v_state.career_date-1)
      INTO v_next;
  END IF;

  IF v_next IS NOT NULL THEN
    UPDATE public.player_career_state
    SET next_match_date=v_next,
        updated_at=now()
    WHERE player_id=p_player
      AND next_match_date IS DISTINCT FROM v_next;
  END IF;

  RETURN v_next;
END $$;

COMMIT;
