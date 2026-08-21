BEGIN;

CREATE OR REPLACE FUNCTION public.record_career_match_gameplay(
  p_opponent text,
  p_competition text,
  p_played boolean,
  p_started boolean,
  p_minutes integer,
  p_goals integer,
  p_assists integer,
  p_rating numeric,
  p_team_goals integer,
  p_opponent_goals integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_player uuid;
  v_state record;
  v_contract record;
  v_session record;
  v_result jsonb;
  v_match_id uuid;
  v_result_code text;
  v_metadata jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user LIMIT 1;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;

  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player;
  SELECT * INTO v_contract
  FROM public.player_contracts
  WHERE player_id=v_player AND status='active'
  ORDER BY signed_at DESC LIMIT 1;
  IF v_contract.id IS NULL THEN RAISE EXCEPTION 'Contrato ativo não encontrado.'; END IF;

  SELECT * INTO v_session
  FROM private.career_match_sessions
  WHERE player_id=v_player AND match_date=v_state.career_date AND status='active'
  FOR UPDATE LIMIT 1;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'Sessão de partida ativa não encontrada.'; END IF;

  IF COALESCE(length(p_metadata::text),0)>30000 THEN RAISE EXCEPTION 'Dados da partida excedem o limite permitido.'; END IF;
  IF COALESCE(p_minutes,0)<0 OR COALESCE(p_minutes,0)>130 THEN RAISE EXCEPTION 'Minutos inválidos.'; END IF;
  IF COALESCE(p_goals,0)<0 OR COALESCE(p_goals,0)>20 OR COALESCE(p_assists,0)<0 OR COALESCE(p_assists,0)>20 THEN RAISE EXCEPTION 'Estatísticas inválidas.'; END IF;
  IF p_rating IS NOT NULL AND (p_rating<0 OR p_rating>10) THEN RAISE EXCEPTION 'Nota inválida.'; END IF;
  IF COALESCE(p_team_goals,0)<0 OR COALESCE(p_opponent_goals,0)<0 THEN RAISE EXCEPTION 'Placar inválido.'; END IF;
  IF p_started AND v_session.selection_status<>'starter' THEN RAISE EXCEPTION 'Escalação inconsistente com a sessão de partida.'; END IF;
  IF NOT COALESCE(p_played,false) AND (COALESCE(p_minutes,0)<>0 OR COALESCE(p_goals,0)<>0 OR COALESCE(p_assists,0)<>0) THEN
    RAISE EXCEPTION 'Estatísticas incompatíveis com jogador sem participação.';
  END IF;

  v_result_code:=CASE
    WHEN p_team_goals>p_opponent_goals THEN 'W'
    WHEN p_team_goals=p_opponent_goals THEN 'D'
    ELSE 'L' END;

  IF v_session.selection_status='out' THEN
    IF COALESCE(p_played,false) OR COALESCE(p_started,false) THEN
      RAISE EXCEPTION 'Jogador fora da lista não pode registrar participação em campo.';
    END IF;

    INSERT INTO public.player_match_history(
      player_id,club_id,context,career_stage,national_level,season_label,competition,opponent,
      match_date,selection_status,appeared,started,minutes,goals,assists,rating,
      team_goals,opponent_goals,result,metadata
    ) VALUES(
      v_player,v_contract.club_id,'club',COALESCE(v_state.career_stage,'academy'),NULL,
      private.current_season_label(v_state.career_date),
      left(COALESCE(NULLIF(trim(p_competition),''),'Competição'),100),
      left(COALESCE(NULLIF(trim(p_opponent),''),'Adversário'),100),
      v_state.career_date,'out',false,false,0,0,0,NULL,
      p_team_goals,p_opponent_goals,v_result_code,'{}'::jsonb
    ) RETURNING id INTO v_match_id;

    v_result:=jsonb_build_object(
      'match_id',v_match_id,
      'result',v_result_code,
      'history',private.player_history_payload(v_player)
    );
  ELSE
    v_result:=public.record_career_match_result(
      p_opponent,p_competition,p_played,p_started,p_minutes,p_goals,p_assists,
      p_rating,p_team_goals,p_opponent_goals
    );
    v_match_id:=(v_result->>'match_id')::uuid;
  END IF;

  v_metadata:=COALESCE(p_metadata,'{}'::jsonb)||jsonb_build_object(
    'engine','career-match-v2',
    'session_id',v_session.id,
    'seed',v_session.seed,
    'opponent_club_id',v_session.opponent_club_id,
    'selection_status',v_session.selection_status
  );

  UPDATE public.player_match_history
  SET metadata=metadata||v_metadata
  WHERE id=v_match_id AND player_id=v_player;

  UPDATE private.career_match_sessions
  SET status='completed',completed_at=now(),metadata=metadata||jsonb_build_object('match_id',v_match_id)
  WHERE id=v_session.id;

  IF COALESCE(p_played,false) THEN
    UPDATE public.player_career_state
    SET energy=private.career_clamp(energy-GREATEST(8,LEAST(28,ROUND(COALESCE(p_minutes,0)*0.22)::integer))),
        fatigue=private.career_clamp(fatigue+GREATEST(5,LEAST(24,ROUND(COALESCE(p_minutes,0)*0.18)::integer))),
        pressure=private.career_clamp(pressure+CASE
          WHEN COALESCE(p_rating,6)>=8 THEN -3
          WHEN COALESCE(p_rating,6)<5.5 THEN 3
          ELSE 0 END),
        updated_at=now()
    WHERE player_id=v_player;
  END IF;

  RETURN v_result||jsonb_build_object(
    'session_id',v_session.id,
    'metadata_saved',true,
    'selection_status',v_session.selection_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb) TO authenticated;

COMMIT;
