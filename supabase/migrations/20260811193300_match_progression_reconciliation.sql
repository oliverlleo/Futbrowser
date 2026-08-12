BEGIN;

CREATE OR REPLACE FUNCTION public.reconcile_career_match_progression()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_player uuid;
  v_state record;
  v_match record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user LIMIT 1;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;

  SELECT * INTO v_state
  FROM public.player_career_state
  WHERE player_id=v_player
  FOR UPDATE;

  IF v_state.career_date IS NULL OR v_state.next_match_date IS NULL THEN
    RETURN jsonb_build_object('advanced',false,'reason','career_not_initialized');
  END IF;

  SELECT * INTO v_match
  FROM public.player_match_history
  WHERE player_id=v_player
    AND context='club'
    AND match_date=v_state.career_date
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('advanced',false,'reason','no_completed_match');
  END IF;

  IF v_state.career_date < v_state.next_match_date THEN
    RETURN jsonb_build_object('advanced',false,'reason','already_advanced','career_date',v_state.career_date,'next_match_date',v_state.next_match_date);
  END IF;

  IF v_match.appeared AND COALESCE(v_match.minutes,0)>0 THEN
    PERFORM private.apply_match_development_maintenance(v_player,v_match.match_date,v_match.minutes);
  END IF;

  UPDATE public.player_career_state
  SET career_date=v_match.match_date+1,
      day_period=0,
      next_match_date=v_match.match_date+7,
      weekly_objective='{}'::jsonb,
      last_development_maintenance_date=CASE
        WHEN v_match.appeared THEN v_match.match_date
        ELSE last_development_maintenance_date
      END,
      updated_at=now()
  WHERE player_id=v_player;

  UPDATE private.career_match_sessions
  SET status='completed',
      completed_at=COALESCE(completed_at,now()),
      metadata=metadata||jsonb_build_object('reconciled_match_id',v_match.id)
  WHERE player_id=v_player
    AND match_date=v_match.match_date
    AND status='active';

  RETURN jsonb_build_object(
    'advanced',true,
    'match_id',v_match.id,
    'career_date',v_match.match_date+1,
    'next_match_date',v_match.match_date+7
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_career_match_progression() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconcile_career_match_progression() TO authenticated;

COMMIT;
