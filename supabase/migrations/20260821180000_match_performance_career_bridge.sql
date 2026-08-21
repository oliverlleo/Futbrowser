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
  v_session record;
  v_result jsonb;
  v_match_id uuid;
  v_result_code text;
  v_metadata jsonb;
  v_load jsonb;
  v_comp_result jsonb;
  v_tactical jsonb;
  v_player_stats jsonb;
  v_trust_delta integer:=0;
  v_morale_delta integer:=0;
  v_new_trust integer;
  v_new_morale integer;
  v_new_hierarchy text;
  v_feedback jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user LIMIT 1;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player;
  SELECT * INTO v_session
  FROM private.career_match_sessions
  WHERE player_id=v_player AND match_date=v_state.career_date AND status='active'
  FOR UPDATE LIMIT 1;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'Sessão de partida ativa não encontrada.'; END IF;
  IF coalesce(length(p_metadata::text),0)>40000 THEN RAISE EXCEPTION 'Dados da partida excedem o limite permitido.'; END IF;
  IF coalesce(p_minutes,0)<0 OR coalesce(p_minutes,0)>130 OR coalesce(p_goals,0)<0 OR coalesce(p_goals,0)>20 OR coalesce(p_assists,0)<0 OR coalesce(p_assists,0)>20 THEN RAISE EXCEPTION 'Estatísticas inválidas.'; END IF;
  IF p_rating IS NOT NULL AND(p_rating<0 OR p_rating>10) THEN RAISE EXCEPTION 'Nota inválida.'; END IF;
  IF coalesce(p_team_goals,0)<0 OR coalesce(p_opponent_goals,0)<0 THEN RAISE EXCEPTION 'Placar inválido.'; END IF;
  IF p_started AND v_session.selection_status<>'starter' THEN RAISE EXCEPTION 'Escalação inconsistente com a decisão do treinador.'; END IF;
  IF NOT coalesce(p_played,false) AND(coalesce(p_minutes,0)<>0 OR coalesce(p_goals,0)<>0 OR coalesce(p_assists,0)<>0) THEN RAISE EXCEPTION 'Estatísticas incompatíveis com jogador sem participação.'; END IF;
  IF v_session.selection_status='out' AND(coalesce(p_played,false) OR coalesce(p_started,false)) THEN RAISE EXCEPTION 'Jogador fora da lista não pode registrar participação em campo.'; END IF;

  v_result_code:=CASE WHEN p_team_goals>p_opponent_goals THEN 'W' WHEN p_team_goals=p_opponent_goals THEN 'D' ELSE 'L' END;
  v_tactical:=coalesce(p_metadata->'tactical_state','{}'::jsonb);
  v_player_stats:=coalesce(p_metadata->'player_stats','{}'::jsonb);
  v_load:=private.career_match_load(CASE WHEN v_session.selection_status='out' THEN 0 ELSE p_minutes END,p_started,p_metadata);

  IF v_session.selection_status='out' THEN
    INSERT INTO public.player_match_history(player_id,club_id,context,career_stage,national_level,season_label,competition,opponent,match_date,selection_status,appeared,started,minutes,goals,assists,rating,team_goals,opponent_goals,result,metadata)
    VALUES(v_player,v_state.club_id,'club',coalesce(v_state.career_stage,'academy'),NULL,private.current_season_label(v_state.career_date),left(coalesce(nullif(trim(p_competition),''),'Competição'),100),left(coalesce(nullif(trim(p_opponent),''),'Adversário'),100),v_state.career_date,'out',false,false,0,0,0,NULL,p_team_goals,p_opponent_goals,v_result_code,'{}'::jsonb)
    RETURNING id INTO v_match_id;
    v_result:=jsonb_build_object('match_id',v_match_id,'result',v_result_code,'history',private.player_history_payload(v_player));
  ELSE
    v_result:=public.record_career_match_result(p_opponent,p_competition,p_played,p_started,p_minutes,p_goals,p_assists,p_rating,p_team_goals,p_opponent_goals);
    v_match_id:=(v_result->>'match_id')::uuid;
  END IF;

  v_comp_result:=private.complete_player_competition_fixture(v_player,v_session.fixture_id,p_team_goals,p_opponent_goals,CASE WHEN v_session.selection_status='out' THEN 0 ELSE p_goals END,CASE WHEN v_session.selection_status='out' THEN 0 ELSE p_assists END,CASE WHEN v_session.selection_status='out' THEN 0 ELSE p_minutes END,CASE WHEN v_session.selection_status='out' THEN false ELSE p_started END,CASE WHEN v_session.selection_status='out' THEN NULL ELSE p_rating END);
  v_metadata:=coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('engine','career-match-v5','session_id',v_session.id,'seed',v_session.seed,'fixture_id',v_session.fixture_id,'opponent_club_id',v_session.opponent_club_id,'selection_status',v_session.selection_status,'match_load',v_load,'competition_result',v_comp_result);
  UPDATE public.player_match_history SET metadata=metadata||v_metadata WHERE id=v_match_id AND player_id=v_player;
  UPDATE private.career_match_sessions SET status='completed',completed_at=now(),metadata=metadata||jsonb_build_object('match_id',v_match_id,'match_load',v_load,'competition_result',v_comp_result) WHERE id=v_session.id;

  IF coalesce(p_played,false) AND v_session.selection_status<>'out' THEN
    v_trust_delta:=CASE WHEN coalesce(p_rating,6)>=8.2 THEN 6 WHEN coalesce(p_rating,6)>=7.2 THEN 3 WHEN coalesce(p_rating,6)<5.5 THEN -5 WHEN coalesce(p_rating,6)<6.2 THEN -2 ELSE 0 END;
    v_trust_delta:=v_trust_delta+CASE WHEN p_started THEN 1 ELSE 0 END+CASE WHEN coalesce(p_goals,0)+coalesce(p_assists,0)>0 THEN 2 ELSE 0 END+CASE WHEN coalesce((v_tactical->>'transitions')::int,0)>=1 THEN 1 ELSE 0 END-CASE WHEN coalesce((v_tactical->>'danger')::int,0)>=70 THEN 1 ELSE 0 END;
    v_morale_delta:=CASE WHEN v_result_code='W' THEN 2 WHEN v_result_code='L' THEN -2 ELSE 0 END+CASE WHEN coalesce(p_rating,6)>=7.5 THEN 2 WHEN coalesce(p_rating,6)<5.5 THEN -2 ELSE 0 END;
    v_new_trust:=private.career_clamp(coalesce(v_state.trust,50)+v_trust_delta);
    v_new_morale:=private.career_clamp(coalesce(v_state.morale,50)+v_morale_delta);
    v_new_hierarchy:=CASE
      WHEN coalesce(v_state.hierarchy,'Reserva')='Promessa' AND v_new_trust>=78 AND coalesce(p_rating,0)>=7.5 THEN 'Reserva'
      WHEN coalesce(v_state.hierarchy,'Reserva')='Reserva' AND v_new_trust>=84 AND coalesce(p_rating,0)>=7.8 THEN 'Rotação'
      WHEN coalesce(v_state.hierarchy,'Reserva')='Rotação' AND v_new_trust>=88 AND coalesce(p_rating,0)>=8.0 THEN 'Titular'
      WHEN coalesce(v_state.hierarchy,'Reserva')='Titular' AND v_new_trust>=94 AND coalesce(p_rating,0)>=8.5 AND coalesce(p_goals,0)+coalesce(p_assists,0)>0 THEN 'Estrela'
      WHEN coalesce(v_state.hierarchy,'Reserva')='Titular' AND v_new_trust<25 AND coalesce(p_rating,6)<5.5 THEN 'Rotação'
      WHEN coalesce(v_state.hierarchy,'Reserva')='Rotação' AND v_new_trust<18 AND coalesce(p_rating,6)<5.2 THEN 'Reserva'
      ELSE coalesce(v_state.hierarchy,'Reserva')
    END;
    UPDATE public.player_career_state
    SET energy=private.career_clamp(energy-coalesce((v_load->>'energy_loss')::int,0)),
        fatigue=private.career_clamp(fatigue+coalesce((v_load->>'fatigue_gain')::int,0)),
        pressure=private.career_clamp(pressure+CASE WHEN coalesce(p_rating,6)>=8 THEN -3 WHEN coalesce(p_rating,6)<5.5 THEN 3 ELSE 0 END),
        trust=v_new_trust,
        morale=v_new_morale,
        hierarchy=v_new_hierarchy,
        updated_at=now()
    WHERE player_id=v_player;
    v_feedback:=jsonb_build_object('trust_delta',v_trust_delta,'morale_delta',v_morale_delta,'trust',v_new_trust,'morale',v_new_morale,'hierarchy_before',v_state.hierarchy,'hierarchy_after',v_new_hierarchy,'hierarchy_changed',v_state.hierarchy IS DISTINCT FROM v_new_hierarchy,'summary',CASE WHEN v_state.hierarchy IS DISTINCT FROM v_new_hierarchy THEN 'Seu desempenho alterou seu status no elenco: '||v_new_hierarchy||'.' WHEN v_trust_delta>0 THEN 'A comissão registrou uma evolução positiva na sua confiança.' WHEN v_trust_delta<0 THEN 'A comissão vai cobrar uma resposta no próximo treino.' ELSE 'Seu status permanece estável; a próxima partida será importante para ganhar espaço.' END);
  ELSE
    v_feedback:=jsonb_build_object('trust_delta',0,'morale_delta',0,'trust',v_state.trust,'morale',v_state.morale,'hierarchy_before',v_state.hierarchy,'hierarchy_after',v_state.hierarchy,'hierarchy_changed',false,'summary','Sem participação em campo, seu status no elenco permanece inalterado.');
  END IF;
  PERFORM private.sync_competition_next_match(v_player);
  RETURN v_result||jsonb_build_object('session_id',v_session.id,'metadata_saved',true,'selection_status',v_session.selection_status,'match_load',v_load,'competition_result',v_comp_result,'career_feedback',v_feedback,'next_match_date',(SELECT next_match_date FROM public.player_career_state WHERE player_id=v_player));
END $$;

REVOKE ALL ON FUNCTION public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb) TO authenticated;

COMMIT;
