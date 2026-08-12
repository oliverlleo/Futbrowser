BEGIN;

-- Strengthen the public gameplay RPC so the browser cannot submit internally
-- impossible individual totals relative to the final score.
DO $$
DECLARE
  v_def text;
  v_old text := 'IF coalesce(p_team_goals,0)<0 OR coalesce(p_opponent_goals,0)<0 THEN RAISE EXCEPTION ''Placar inválido.'';END IF;';
  v_new text := 'IF coalesce(p_team_goals,0)<0 OR coalesce(p_opponent_goals,0)<0 OR coalesce(p_team_goals,0)>20 OR coalesce(p_opponent_goals,0)>20 THEN RAISE EXCEPTION ''Placar inválido.'';END IF; IF coalesce(p_goals,0)>coalesce(p_team_goals,0) OR coalesce(p_assists,0)>greatest(0,coalesce(p_team_goals,0)-coalesce(p_goals,0)) THEN RAISE EXCEPTION ''Estatísticas individuais incompatíveis com o placar.'';END IF; IF coalesce(p_played,false) AND coalesce(p_minutes,0)<=0 THEN RAISE EXCEPTION ''Participação em campo exige minutos jogados.'';END IF; IF coalesce(p_started,false) AND NOT coalesce(p_played,false) THEN RAISE EXCEPTION ''Titular precisa registrar participação em campo.'';END IF; IF NOT coalesce(p_played,false) AND p_rating IS NOT NULL THEN RAISE EXCEPTION ''Jogador sem participação não pode receber nota.'';END IF;';
BEGIN
  SELECT pg_get_functiondef('public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb)'::regprocedure)
    INTO v_def;

  IF position(v_old IN v_def) > 0 THEN
    EXECUTE replace(v_def, v_old, v_new);
  ELSIF position('Estatísticas individuais incompatíveis com o placar.' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Não foi possível reforçar a validação das estatísticas da partida.';
  END IF;
END $$;

-- User-controlled fixtures must populate AI assists too, otherwise the assist
-- leaderboard is biased against clubs whose fixture involved the user's team.
DO $$
DECLARE
  v_def text;
  v_old text := 'FOR v_i IN 1..greatest(0,p_team_goals-p_goals) LOOP PERFORM private.add_ai_competition_stat(v_f.season_id,v_club,true,false,v_f.id::text||'':utg:''||v_i);END LOOP;FOR v_i IN 1..p_opp_goals LOOP PERFORM private.add_ai_competition_stat(v_f.season_id,CASE WHEN v_is_home THEN v_f.away_club_id ELSE v_f.home_club_id END,true,false,v_f.id::text||'':uog:''||v_i);END LOOP;';
  v_new text := 'FOR v_i IN 1..greatest(0,p_team_goals-p_goals) LOOP PERFORM private.add_ai_competition_stat(v_f.season_id,v_club,true,false,v_f.id::text||'':utg:''||v_i);IF v_i>greatest(0,coalesce(p_assists,0)) AND mod(abs(hashtext(v_f.id::text||'':uta:''||v_i)),100)<72 THEN PERFORM private.add_ai_competition_stat(v_f.season_id,v_club,false,true,v_f.id::text||'':uta:''||v_i);END IF;END LOOP; FOR v_i IN 1..greatest(0,p_goals) LOOP IF mod(abs(hashtext(v_f.id::text||'':uga:''||v_i)),100)<72 THEN PERFORM private.add_ai_competition_stat(v_f.season_id,v_club,false,true,v_f.id::text||'':uga:''||v_i);END IF;END LOOP; FOR v_i IN 1..greatest(0,p_opp_goals) LOOP PERFORM private.add_ai_competition_stat(v_f.season_id,CASE WHEN v_is_home THEN v_f.away_club_id ELSE v_f.home_club_id END,true,false,v_f.id::text||'':uog:''||v_i);IF mod(abs(hashtext(v_f.id::text||'':uoa:''||v_i)),100)<72 THEN PERFORM private.add_ai_competition_stat(v_f.season_id,CASE WHEN v_is_home THEN v_f.away_club_id ELSE v_f.home_club_id END,false,true,v_f.id::text||'':uoa:''||v_i);END IF;END LOOP;';
BEGIN
  SELECT pg_get_functiondef('private.complete_player_competition_fixture(uuid,uuid,integer,integer,integer,integer,integer,boolean,numeric)'::regprocedure)
    INTO v_def;

  IF position(v_old IN v_def) > 0 THEN
    EXECUTE replace(v_def, v_old, v_new);
  ELSIF position(''':uoa:''' IN v_def) = 0 OR position(''':uga:''' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Não foi possível equilibrar assistências de IA nas partidas do usuário.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
