BEGIN;

INSERT INTO public.competition_definitions(code,name,short_name,career_stage,age_level,format,division_level,team_count,double_round,promotion_slots,relegation_slots,champion_reward,top_scorer_reward,top_assist_reward,rules,display_order,is_active) VALUES
('ACA_U15_CUP','Copa Nacional Sub-15','Copa Sub-15','academy','u15','knockout',NULL,16,false,0,0,350,180,140,'{"penalties_on_draw":true}',15,true),
('ACA_U17_CUP','Copa Nacional Sub-17','Copa Sub-17','academy','u17','knockout',NULL,16,false,0,0,500,260,190,'{"penalties_on_draw":true}',16,true),
('ACA_U20_CUP','Copa Nacional Sub-20','Copa Sub-20','academy','u20','knockout',NULL,16,false,0,0,900,450,350,'{"penalties_on_draw":true}',17,true)
ON CONFLICT(code) DO UPDATE SET name=excluded.name,short_name=excluded.short_name,champion_reward=excluded.champion_reward,top_scorer_reward=excluded.top_scorer_reward,top_assist_reward=excluded.top_assist_reward,is_active=true;

CREATE OR REPLACE FUNCTION private.academy_competition_level(p_player uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT CASE WHEN coalesce(j.idade,18)<=15 THEN 'U15' WHEN coalesce(j.idade,18)<=17 THEN 'U17' WHEN coalesce(j.idade,18)<=18 THEN 'U18' ELSE 'U20' END FROM public.jogadores j WHERE j.id=p_player
$$;

CREATE OR REPLACE FUNCTION private.ensure_competition_world(p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record;v_year int;v_start date;v_level text;
BEGIN
 SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;IF v_state.player_id IS NULL THEN RETURN;END IF;
 v_year:=extract(year FROM v_state.career_date)::int;v_start:=greatest(v_state.career_date+2,coalesce(v_state.next_match_date,v_state.career_date+6));
 IF coalesce(v_state.career_stage,'academy')='academy' THEN
   v_level:=private.academy_competition_level(p_player_id);
   PERFORM private.create_competition_season(p_player_id,'ACA_'||v_level||'_LEAGUE',v_year,v_start);
   PERFORM private.create_competition_season(p_player_id,'ACA_'||v_level||'_CUP',v_year,v_start+3);
 ELSE
   PERFORM private.ensure_division_map(p_player_id,v_year);
   PERFORM private.create_competition_season(p_player_id,'PRO_A',v_year,v_start);
   PERFORM private.create_competition_season(p_player_id,'PRO_B',v_year,v_start);
   PERFORM private.create_competition_season(p_player_id,'PRO_C',v_year,v_start);
   PERFORM private.create_competition_season(p_player_id,'PRO_D',v_year,v_start);
   PERFORM private.create_competition_season(p_player_id,'PRO_CUP',v_year,v_start+3);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION private.roll_competition_world_if_needed(p_player uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record;v_year int;v_stage text;v_start date;v_level text;
BEGIN
 SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player;SELECT coalesce(max(season_year),extract(year FROM v_state.career_date)::int) INTO v_year FROM public.career_competition_seasons WHERE player_id=p_player;
 IF EXISTS(SELECT 1 FROM public.career_competition_fixtures f JOIN public.career_competition_seasons s ON s.id=f.season_id WHERE s.player_id=p_player AND s.season_year=v_year AND f.status='scheduled' AND v_state.club_id IN(f.home_club_id,f.away_club_id)) THEN RETURN;END IF;
 v_stage:=coalesce(v_state.career_stage,'academy');IF v_stage='professional' AND (SELECT count(*) FROM public.career_competition_seasons WHERE player_id=p_player AND season_year=v_year AND competition_code IN('PRO_A','PRO_B','PRO_C','PRO_D') AND status='completed')<4 THEN RETURN;END IF;v_start:=v_state.career_date+28;
 IF v_stage='academy' THEN
   v_level:=private.academy_competition_level(p_player);
   PERFORM private.create_competition_season(p_player,'ACA_'||v_level||'_LEAGUE',v_year+1,v_start);
   PERFORM private.create_competition_season(p_player,'ACA_'||v_level||'_CUP',v_year+1,v_start+3);
 ELSE
   PERFORM private.ensure_division_map(p_player,v_year+1);
   PERFORM private.create_competition_season(p_player,'PRO_A',v_year+1,v_start);
   PERFORM private.create_competition_season(p_player,'PRO_B',v_year+1,v_start);
   PERFORM private.create_competition_season(p_player,'PRO_C',v_year+1,v_start);
   PERFORM private.create_competition_season(p_player,'PRO_D',v_year+1,v_start);
   PERFORM private.create_competition_season(p_player,'PRO_CUP',v_year+1,v_start+3);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_career_match_gameplay(
  p_opponent text,p_competition text,p_played boolean,p_started boolean,p_minutes integer,p_goals integer,p_assists integer,p_rating numeric,p_team_goals integer,p_opponent_goals integer,p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_user uuid:=auth.uid();v_player uuid;v_state record;v_contract record;v_session record;v_result jsonb;v_match_id uuid;v_result_code text;v_metadata jsonb;v_load jsonb;v_comp_result jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.';END IF;
 SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user LIMIT 1;IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;
 SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player;
 SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=v_player AND status='active' ORDER BY signed_at DESC LIMIT 1;IF v_contract.id IS NULL THEN RAISE EXCEPTION 'Contrato ativo não encontrado.';END IF;
 SELECT * INTO v_session FROM private.career_match_sessions WHERE player_id=v_player AND match_date=v_state.career_date AND status='active' FOR UPDATE LIMIT 1;IF v_session.id IS NULL THEN RAISE EXCEPTION 'Sessão de partida ativa não encontrada.';END IF;
 IF coalesce(length(p_metadata::text),0)>40000 THEN RAISE EXCEPTION 'Dados da partida excedem o limite permitido.';END IF;
 IF coalesce(p_minutes,0)<0 OR coalesce(p_minutes,0)>130 OR coalesce(p_goals,0)<0 OR coalesce(p_goals,0)>20 OR coalesce(p_assists,0)<0 OR coalesce(p_assists,0)>20 THEN RAISE EXCEPTION 'Estatísticas inválidas.';END IF;
 IF p_rating IS NOT NULL AND(p_rating<0 OR p_rating>10) THEN RAISE EXCEPTION 'Nota inválida.';END IF;
 IF coalesce(p_team_goals,0)<0 OR coalesce(p_opponent_goals,0)<0 THEN RAISE EXCEPTION 'Placar inválido.';END IF;
 IF p_started AND v_session.selection_status<>'starter' THEN RAISE EXCEPTION 'Escalação inconsistente com a sessão de partida.';END IF;
 IF NOT coalesce(p_played,false) AND(coalesce(p_minutes,0)<>0 OR coalesce(p_goals,0)<>0 OR coalesce(p_assists,0)<>0) THEN RAISE EXCEPTION 'Estatísticas incompatíveis com jogador sem participação.';END IF;
 IF v_session.selection_status='out' AND(coalesce(p_played,false) OR coalesce(p_started,false)) THEN RAISE EXCEPTION 'Jogador fora da lista não pode registrar participação em campo.';END IF;

 v_result_code:=CASE WHEN p_team_goals>p_opponent_goals THEN 'W' WHEN p_team_goals=p_opponent_goals THEN 'D' ELSE 'L' END;
 v_load:=private.career_match_load(CASE WHEN v_session.selection_status='out' THEN 0 ELSE p_minutes END,p_started,p_metadata);

 IF v_session.selection_status='out' THEN
   INSERT INTO public.player_match_history(player_id,club_id,context,career_stage,national_level,season_label,competition,opponent,match_date,selection_status,appeared,started,minutes,goals,assists,rating,team_goals,opponent_goals,result,metadata)
   VALUES(v_player,v_contract.club_id,'club',coalesce(v_state.career_stage,'academy'),NULL,private.current_season_label(v_state.career_date),left(coalesce(nullif(trim(p_competition),''),'Competição'),100),left(coalesce(nullif(trim(p_opponent),''),'Adversário'),100),v_state.career_date,'out',false,false,0,0,0,NULL,p_team_goals,p_opponent_goals,v_result_code,'{}'::jsonb)
   RETURNING id INTO v_match_id;
   v_result:=jsonb_build_object('match_id',v_match_id,'result',v_result_code,'history',private.player_history_payload(v_player));
 ELSE
   v_result:=public.record_career_match_result(p_opponent,p_competition,p_played,p_started,p_minutes,p_goals,p_assists,p_rating,p_team_goals,p_opponent_goals);v_match_id:=(v_result->>'match_id')::uuid;
 END IF;

 v_comp_result:=private.complete_player_competition_fixture(v_player,v_session.fixture_id,p_team_goals,p_opponent_goals,CASE WHEN v_session.selection_status='out' THEN 0 ELSE p_goals END,CASE WHEN v_session.selection_status='out' THEN 0 ELSE p_assists END,CASE WHEN v_session.selection_status='out' THEN 0 ELSE p_minutes END,CASE WHEN v_session.selection_status='out' THEN false ELSE p_started END,CASE WHEN v_session.selection_status='out' THEN NULL ELSE p_rating END);
 v_metadata:=coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('engine','career-match-v4','session_id',v_session.id,'seed',v_session.seed,'fixture_id',v_session.fixture_id,'opponent_club_id',v_session.opponent_club_id,'selection_status',v_session.selection_status,'match_load',v_load,'competition_result',v_comp_result);
 UPDATE public.player_match_history SET metadata=metadata||v_metadata WHERE id=v_match_id AND player_id=v_player;
 UPDATE private.career_match_sessions SET status='completed',completed_at=now(),metadata=metadata||jsonb_build_object('match_id',v_match_id,'match_load',v_load,'competition_result',v_comp_result) WHERE id=v_session.id;
 IF coalesce(p_played,false) AND v_session.selection_status<>'out' THEN UPDATE public.player_career_state SET energy=private.career_clamp(energy-coalesce((v_load->>'energy_loss')::int,0)),fatigue=private.career_clamp(fatigue+coalesce((v_load->>'fatigue_gain')::int,0)),pressure=private.career_clamp(pressure+CASE WHEN coalesce(p_rating,6)>=8 THEN -3 WHEN coalesce(p_rating,6)<5.5 THEN 3 ELSE 0 END),updated_at=now() WHERE player_id=v_player;END IF;
 PERFORM private.sync_competition_next_match(v_player);
 RETURN v_result||jsonb_build_object('session_id',v_session.id,'metadata_saved',true,'selection_status',v_session.selection_status,'match_load',v_load,'competition_result',v_comp_result,'next_match_date',(SELECT next_match_date FROM public.player_career_state WHERE player_id=v_player));
END $$;
REVOKE ALL ON FUNCTION public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb) FROM public,anon;GRANT EXECUTE ON FUNCTION public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb) TO authenticated;

-- Create/sync the competition world for all careers already present. This does not simulate the user's own match.
DO $$ DECLARE v_player uuid;BEGIN FOR v_player IN SELECT player_id FROM public.player_career_state LOOP PERFORM private.ensure_competition_world(v_player);PERFORM private.simulate_due_competition_fixtures(v_player,(SELECT career_date FROM public.player_career_state WHERE player_id=v_player));PERFORM private.sync_competition_next_match(v_player);END LOOP;END $$;

COMMIT;
