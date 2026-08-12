BEGIN;

ALTER TABLE private.career_match_sessions ADD COLUMN IF NOT EXISTS fixture_id uuid REFERENCES public.career_competition_fixtures(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_career_match_session_fixture ON private.career_match_sessions(fixture_id) WHERE fixture_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.current_career_fixture(p_player uuid,p_date date,p_club uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT f.id FROM public.career_competition_fixtures f JOIN public.career_competition_seasons s ON s.id=f.season_id WHERE s.player_id=p_player AND f.match_date=p_date AND f.status='scheduled' AND f.home_club_id IS NOT NULL AND f.away_club_id IS NOT NULL AND p_club IN(f.home_club_id,f.away_club_id) ORDER BY CASE WHEN s.competition_code LIKE '%CUP%' THEN 0 ELSE 1 END,f.round_number LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.career_match_opponent(p_player_id uuid,p_club_id uuid,p_match_date date)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_fixture record;v_opp uuid;
BEGIN
 SELECT f.home_club_id,f.away_club_id INTO v_fixture FROM public.career_competition_fixtures f JOIN public.career_competition_seasons s ON s.id=f.season_id WHERE s.player_id=p_player_id AND f.match_date=p_match_date AND f.status='scheduled' AND p_club_id IN(f.home_club_id,f.away_club_id) ORDER BY CASE WHEN s.competition_code LIKE '%CUP%' THEN 0 ELSE 1 END,f.round_number LIMIT 1;
 IF v_fixture.home_club_id IS NOT NULL THEN RETURN CASE WHEN v_fixture.home_club_id=p_club_id THEN v_fixture.away_club_id ELSE v_fixture.home_club_id END;END IF;
 SELECT c.id INTO v_opp FROM public.base_clubs c WHERE c.id<>p_club_id AND c.club_level=(SELECT club_level FROM public.base_clubs WHERE id=p_club_id) ORDER BY md5(p_player_id::text||':'||p_match_date::text||':'||c.id::text) LIMIT 1;RETURN v_opp;
END $$;

CREATE OR REPLACE FUNCTION private.career_match_competition_label(p_player uuid,p_club uuid,p_date date)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT coalesce((SELECT d.name FROM public.career_competition_fixtures f JOIN public.career_competition_seasons s ON s.id=f.season_id JOIN public.competition_definitions d ON d.code=s.competition_code WHERE s.player_id=p_player AND f.match_date=p_date AND p_club IN(f.home_club_id,f.away_club_id) ORDER BY CASE WHEN s.competition_code LIKE '%CUP%' THEN 0 ELSE 1 END LIMIT 1),CASE WHEN (SELECT career_stage FROM public.player_career_state WHERE player_id=p_player)='professional' THEN 'Liga Nacional' ELSE 'Liga Nacional Sub-18' END)
$$;

CREATE OR REPLACE FUNCTION private.fill_match_session_fixture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.fixture_id IS NULL THEN NEW.fixture_id:=private.current_career_fixture(NEW.player_id,NEW.match_date,NEW.club_id);END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fill_match_session_fixture ON private.career_match_sessions;
CREATE TRIGGER trg_fill_match_session_fixture BEFORE INSERT ON private.career_match_sessions FOR EACH ROW EXECUTE FUNCTION private.fill_match_session_fixture();

DO $$ DECLARE v_def text;v_old text;v_new text;BEGIN
 SELECT pg_get_functiondef('public.get_career_match_context()'::regprocedure) INTO v_def;
 v_old:='v_competition:=CASE WHEN COALESCE(v_state.career_stage,''academy'')=''professional'' THEN ''Campeonato Profissional'' ELSE ''Liga de Base'' END;';
 v_new:='v_competition:=private.career_match_competition_label(v_player.id,v_club.id,v_state.career_date);';
 IF position(v_old IN v_def)>0 THEN EXECUTE replace(v_def,v_old,v_new);ELSIF position('private.career_match_competition_label' IN v_def)=0 THEN RAISE EXCEPTION 'Ponto de competição do contexto de partida não encontrado.';END IF;
END $$;

CREATE OR REPLACE FUNCTION private.register_ai_lineup_stats(p_season uuid,p_club uuid,p_minutes int DEFAULT 90,p_limit int DEFAULT 11)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_ai record;
BEGIN
 FOR v_ai IN SELECT ai.* FROM public.base_ai_players ai WHERE ai.club_id=p_club ORDER BY ai.is_starter DESC,ai.ovr DESC,ai.id LIMIT p_limit LOOP
  INSERT INTO public.career_competition_player_stats(season_id,entity_key,club_id,ai_player_id,display_name,appearances,starts,minutes)
  VALUES(p_season,'ai:'||v_ai.id,p_club,v_ai.id,v_ai.name,1,1,p_minutes)
  ON CONFLICT(season_id,entity_key) DO UPDATE SET appearances=public.career_competition_player_stats.appearances+1,starts=public.career_competition_player_stats.starts+1,minutes=public.career_competition_player_stats.minutes+p_minutes;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.add_ai_competition_stat(p_season uuid,p_club uuid,p_goal boolean,p_assist boolean,p_salt text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_ai record;
BEGIN
 SELECT ai.* INTO v_ai FROM public.base_ai_players ai WHERE ai.club_id=p_club ORDER BY (CASE ai.primary_position WHEN 'Atacante' THEN 20 WHEN 'Ponta Direita' THEN 15 WHEN 'Ponta Esquerda' THEN 15 WHEN 'Meia Direita' THEN 10 WHEN 'Meia Esquerda' THEN 10 ELSE 0 END)+ai.ovr DESC,md5(ai.id::text||p_salt) LIMIT 1;IF v_ai.id IS NULL THEN RETURN;END IF;
 INSERT INTO public.career_competition_player_stats(season_id,entity_key,club_id,ai_player_id,display_name,goals,assists)
 VALUES(p_season,'ai:'||v_ai.id,p_club,v_ai.id,v_ai.name,CASE WHEN p_goal THEN 1 ELSE 0 END,CASE WHEN p_assist THEN 1 ELSE 0 END)
 ON CONFLICT(season_id,entity_key) DO UPDATE SET goals=public.career_competition_player_stats.goals+CASE WHEN p_goal THEN 1 ELSE 0 END,assists=public.career_competition_player_stats.assists+CASE WHEN p_assist THEN 1 ELSE 0 END;
END $$;

CREATE OR REPLACE FUNCTION private.simulate_competition_fixture(p_fixture uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_f record;v_home_strength numeric;v_away_strength numeric;v_h int;v_a int;v_i int;v_hp int;v_ap int;
BEGIN
 SELECT * INTO v_f FROM public.career_competition_fixtures WHERE id=p_fixture FOR UPDATE;IF v_f.id IS NULL OR v_f.status='completed' OR v_f.home_club_id IS NULL OR v_f.away_club_id IS NULL THEN RETURN;END IF;
 v_home_strength:=private.club_competition_strength(v_f.home_club_id);v_away_strength:=private.club_competition_strength(v_f.away_club_id);v_h:=private.simulated_goal_count(v_f.id,'h',v_home_strength-v_away_strength,true);v_a:=private.simulated_goal_count(v_f.id,'a',v_away_strength-v_home_strength,false);
 IF v_f.stage<>'league' AND v_h=v_a THEN v_hp:=3+mod(abs(hashtext(v_f.id::text||':hp')),4);v_ap:=3+mod(abs(hashtext(v_f.id::text||':ap')),4);IF v_hp=v_ap THEN IF mod(abs(hashtext(v_f.id::text||':pw')),2)=0 THEN v_hp:=v_hp+1;ELSE v_ap:=v_ap+1;END IF;END IF;END IF;
 UPDATE public.career_competition_fixtures SET status='completed',home_goals=v_h,away_goals=v_a,home_penalties=v_hp,away_penalties=v_ap,simulated_at=now() WHERE id=v_f.id;
 PERFORM private.register_ai_lineup_stats(v_f.season_id,v_f.home_club_id);PERFORM private.register_ai_lineup_stats(v_f.season_id,v_f.away_club_id);
 FOR v_i IN 1..v_h LOOP PERFORM private.add_ai_competition_stat(v_f.season_id,v_f.home_club_id,true,false,v_f.id::text||':hg:'||v_i);IF mod(abs(hashtext(v_f.id::text||':ha:'||v_i)),100)<72 THEN PERFORM private.add_ai_competition_stat(v_f.season_id,v_f.home_club_id,false,true,v_f.id::text||':ha:'||v_i);END IF;END LOOP;
 FOR v_i IN 1..v_a LOOP PERFORM private.add_ai_competition_stat(v_f.season_id,v_f.away_club_id,true,false,v_f.id::text||':ag:'||v_i);IF mod(abs(hashtext(v_f.id::text||':aa:'||v_i)),100)<72 THEN PERFORM private.add_ai_competition_stat(v_f.season_id,v_f.away_club_id,false,true,v_f.id::text||':aa:'||v_i);END IF;END LOOP;
 IF v_f.stage<>'league' THEN PERFORM private.propagate_knockout_winner(v_f.id);END IF;PERFORM private.finalize_competition_season(v_f.season_id);
END $$;

CREATE OR REPLACE FUNCTION private.career_match_load(p_minutes int,p_started boolean,p_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_ps jsonb:=coalesce(p_metadata->'player_stats','{}'::jsonb);v_minutes int:=greatest(0,coalesce(p_minutes,0));v_actions numeric;v_end_energy numeric;v_intensity numeric;v_energy_loss int;v_fatigue_gain int;v_label text;v_recovery int;
BEGIN
 v_actions:=coalesce((v_ps->>'high_intensity_actions')::numeric,0)*1.5+coalesce((v_ps->>'physical_actions')::numeric,0)+coalesce((v_ps->>'duelsWon')::numeric,0)+coalesce((v_ps->>'duelsLost')::numeric,0)+coalesce((v_ps->>'dribblesAttempted')::numeric,0)*0.7+coalesce((v_ps->>'shots')::numeric,0)*1.2;
 v_end_energy:=coalesce((v_ps->>'end_match_energy')::numeric,coalesce((p_metadata->>'end_match_energy')::numeric,65));
 v_intensity:=least(1.65,greatest(.55,.42+(v_minutes/150.0)+(v_actions/85.0)+((100-least(100,greatest(0,v_end_energy)))/210.0)+CASE WHEN p_started THEN .06 ELSE 0 END));
 v_energy_loss:=greatest(CASE WHEN v_minutes>0 THEN 5 ELSE 0 END,least(34,round((4+v_minutes*.105)*v_intensity)::int));
 v_fatigue_gain:=greatest(CASE WHEN v_minutes>0 THEN 3 ELSE 0 END,least(30,round((3+v_minutes*.082)*v_intensity)::int));
 v_label:=CASE WHEN v_intensity>=1.35 THEN 'Muito desgastante' WHEN v_intensity>=1.12 THEN 'Desgastante' WHEN v_intensity>=.88 THEN 'Moderada' ELSE 'Leve' END;v_recovery:=CASE WHEN v_intensity>=1.35 THEN 3 WHEN v_intensity>=1.05 THEN 2 ELSE 1 END;
 RETURN jsonb_build_object('label',v_label,'intensity',round(v_intensity,2),'energy_loss',v_energy_loss,'fatigue_gain',v_fatigue_gain,'recovery_days',v_recovery,'minutes',v_minutes,'physical_actions',round(v_actions),'end_match_energy',round(v_end_energy));
END $$;

CREATE OR REPLACE FUNCTION private.complete_player_competition_fixture(p_player uuid,p_fixture uuid,p_team_goals int,p_opp_goals int,p_goals int,p_assists int,p_minutes int,p_started boolean,p_rating numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_f record;v_s record;v_club uuid;v_is_home boolean;v_h int;v_a int;v_hp int;v_ap int;v_i int;v_result text;v_winner uuid;v_player_name text;
BEGIN
 IF p_fixture IS NULL THEN RETURN '{}'::jsonb;END IF;SELECT f.*,s.player_id owner_player,s.competition_code FROM public.career_competition_fixtures f JOIN public.career_competition_seasons s ON s.id=f.season_id WHERE f.id=p_fixture AND s.player_id=p_player FOR UPDATE INTO v_f;IF v_f.id IS NULL THEN RAISE EXCEPTION 'Fixture da competição não encontrado.';END IF;SELECT club_id INTO v_club FROM public.player_career_state WHERE player_id=p_player;v_is_home:=v_f.home_club_id=v_club;IF NOT v_is_home AND v_f.away_club_id<>v_club THEN RAISE EXCEPTION 'Fixture não pertence ao clube do jogador.';END IF;
 v_h:=CASE WHEN v_is_home THEN p_team_goals ELSE p_opp_goals END;v_a:=CASE WHEN v_is_home THEN p_opp_goals ELSE p_team_goals END;
 IF v_f.stage<>'league' AND v_h=v_a THEN v_hp:=3+mod(abs(hashtext(v_f.id::text||':userhp:'||coalesce(p_rating,6)::text)),4);v_ap:=3+mod(abs(hashtext(v_f.id::text||':userap:'||p_player::text)),4);IF v_hp=v_ap THEN IF mod(abs(hashtext(v_f.id::text||':userpw:'||p_player::text)),100)<50+greatest(-15,least(15,round((coalesce(p_rating,6)-6)*8)::int)) THEN IF v_is_home THEN v_hp:=v_hp+1;ELSE v_ap:=v_ap+1;END IF;ELSE IF v_is_home THEN v_ap:=v_ap+1;ELSE v_hp:=v_hp+1;END IF;END IF;END IF;
 UPDATE public.career_competition_fixtures SET status='completed',home_goals=v_h,away_goals=v_a,home_penalties=v_hp,away_penalties=v_ap,simulated_at=now(),metadata=metadata||jsonb_build_object('source','player_gameplay') WHERE id=v_f.id;
 SELECT nome INTO v_player_name FROM public.jogadores WHERE id=p_player;INSERT INTO public.career_competition_player_stats(season_id,entity_key,club_id,player_id,display_name,appearances,starts,minutes,goals,assists,rating_sum,rated_games) VALUES(v_f.season_id,'user:'||p_player,v_club,p_player,v_player_name,CASE WHEN p_minutes>0 THEN 1 ELSE 0 END,CASE WHEN p_started THEN 1 ELSE 0 END,p_minutes,p_goals,p_assists,coalesce(p_rating,0),CASE WHEN p_rating IS NULL THEN 0 ELSE 1 END) ON CONFLICT(season_id,entity_key) DO UPDATE SET appearances=public.career_competition_player_stats.appearances+CASE WHEN p_minutes>0 THEN 1 ELSE 0 END,starts=public.career_competition_player_stats.starts+CASE WHEN p_started THEN 1 ELSE 0 END,minutes=public.career_competition_player_stats.minutes+p_minutes,goals=public.career_competition_player_stats.goals+p_goals,assists=public.career_competition_player_stats.assists+p_assists,rating_sum=public.career_competition_player_stats.rating_sum+coalesce(p_rating,0),rated_games=public.career_competition_player_stats.rated_games+CASE WHEN p_rating IS NULL THEN 0 ELSE 1 END;
 PERFORM private.register_ai_lineup_stats(v_f.season_id,v_f.home_club_id);PERFORM private.register_ai_lineup_stats(v_f.season_id,v_f.away_club_id);
 FOR v_i IN 1..greatest(0,p_team_goals-p_goals) LOOP PERFORM private.add_ai_competition_stat(v_f.season_id,v_club,true,false,v_f.id::text||':utg:'||v_i);END LOOP;FOR v_i IN 1..p_opp_goals LOOP PERFORM private.add_ai_competition_stat(v_f.season_id,CASE WHEN v_is_home THEN v_f.away_club_id ELSE v_f.home_club_id END,true,false,v_f.id::text||':uog:'||v_i);END LOOP;
 IF v_f.stage<>'league' THEN PERFORM private.propagate_knockout_winner(v_f.id);END IF;PERFORM private.finalize_competition_season(v_f.season_id);v_winner:=private.fixture_winner(v_f.id);v_result:=CASE WHEN v_winner IS NULL THEN CASE WHEN p_team_goals>p_opp_goals THEN 'W' WHEN p_team_goals=p_opp_goals THEN 'D' ELSE 'L' END WHEN v_winner=v_club THEN 'W' ELSE 'L' END;
 RETURN jsonb_build_object('fixture_id',v_f.id,'competition_code',v_f.competition_code,'stage',v_f.stage,'round',v_f.round_number,'result',v_result,'penalties',CASE WHEN v_hp IS NULL THEN NULL ELSE jsonb_build_object('home',v_hp,'away',v_ap) END,'winner_club_id',v_winner);
END $$;

CREATE OR REPLACE FUNCTION private.roll_competition_world_if_needed(p_player uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record;v_year int;v_stage text;v_start date;
BEGIN
 SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player;SELECT coalesce(max(season_year),extract(year FROM v_state.career_date)::int) INTO v_year FROM public.career_competition_seasons WHERE player_id=p_player;IF EXISTS(SELECT 1 FROM public.career_competition_fixtures f JOIN public.career_competition_seasons s ON s.id=f.season_id WHERE s.player_id=p_player AND s.season_year=v_year AND f.status='scheduled' AND v_state.club_id IN(f.home_club_id,f.away_club_id)) THEN RETURN;END IF;
 v_stage:=coalesce(v_state.career_stage,'academy');IF v_stage='professional' AND (SELECT count(*) FROM public.career_competition_seasons WHERE player_id=p_player AND season_year=v_year AND competition_code IN('PRO_A','PRO_B','PRO_C','PRO_D') AND status='completed')<4 THEN RETURN;END IF;v_start:=v_state.career_date+28;
 IF v_stage='academy' THEN PERFORM private.create_competition_season(p_player,'ACA_U18_LEAGUE',v_year+1,v_start);PERFORM private.create_competition_season(p_player,'ACA_U18_CUP',v_year+1,v_start+3);ELSE PERFORM private.ensure_division_map(p_player,v_year+1);PERFORM private.create_competition_season(p_player,'PRO_A',v_year+1,v_start);PERFORM private.create_competition_season(p_player,'PRO_B',v_year+1,v_start);PERFORM private.create_competition_season(p_player,'PRO_C',v_year+1,v_start);PERFORM private.create_competition_season(p_player,'PRO_D',v_year+1,v_start);PERFORM private.create_competition_season(p_player,'PRO_CUP',v_year+1,v_start+3);END IF;
END $$;

CREATE OR REPLACE FUNCTION private.sync_competition_next_match(p_player uuid)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record;v_next date;
BEGIN
 SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player;PERFORM private.ensure_competition_world(p_player);SELECT private.next_career_fixture_date(p_player,v_state.career_date-1) INTO v_next;IF v_next IS NULL THEN PERFORM private.roll_competition_world_if_needed(p_player);SELECT private.next_career_fixture_date(p_player,v_state.career_date-1) INTO v_next;END IF;IF v_next IS NOT NULL THEN UPDATE public.player_career_state SET next_match_date=v_next,updated_at=now() WHERE player_id=p_player AND next_match_date IS DISTINCT FROM v_next;END IF;RETURN v_next;
END $$;

CREATE OR REPLACE FUNCTION public.bootstrap_career_competitions()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_player uuid;v_date date;v_next date;v_sim int;
BEGIN SELECT id INTO v_player FROM public.jogadores WHERE user_id=(SELECT auth.uid()) LIMIT 1;IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;SELECT career_date INTO v_date FROM public.player_career_state WHERE player_id=v_player;PERFORM private.ensure_competition_world(v_player);v_sim:=private.simulate_due_competition_fixtures(v_player,v_date);v_next:=private.sync_competition_next_match(v_player);RETURN jsonb_build_object('ready',true,'career_date',v_date,'next_match_date',v_next,'simulated_fixtures',v_sim);END $$;
REVOKE ALL ON FUNCTION public.bootstrap_career_competitions() FROM public,anon;GRANT EXECUTE ON FUNCTION public.bootstrap_career_competitions() TO authenticated;

CREATE OR REPLACE FUNCTION private.after_scheduled_career_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record;v_is_scheduled boolean:=false;v_next date;
BEGIN
 IF NEW.context<>'club' THEN RETURN NEW;END IF;SELECT career_date,next_match_date INTO v_state FROM public.player_career_state WHERE player_id=NEW.player_id FOR UPDATE;v_is_scheduled:=v_state.next_match_date IS NOT NULL AND NEW.match_date=v_state.next_match_date;
 IF NEW.appeared AND NEW.minutes>0 THEN PERFORM private.apply_match_development_maintenance(NEW.player_id,NEW.match_date,NEW.minutes);END IF;
 IF v_is_scheduled THEN UPDATE public.player_career_state SET career_date=NEW.match_date+1,day_period=0,weekly_objective='{}'::jsonb,last_development_maintenance_date=CASE WHEN NEW.appeared THEN NEW.match_date ELSE last_development_maintenance_date END,updated_at=now() WHERE player_id=NEW.player_id;PERFORM private.simulate_due_competition_fixtures(NEW.player_id,NEW.match_date+1);v_next:=private.next_career_fixture_date(NEW.player_id,NEW.match_date);IF v_next IS NOT NULL THEN UPDATE public.player_career_state SET next_match_date=v_next WHERE player_id=NEW.player_id;END IF;UPDATE public.player_sponsor_opportunities SET status='expired' WHERE player_id=NEW.player_id AND status='available' AND expires_on<NEW.match_date+1;END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_after_scheduled_career_match ON public.player_match_history;CREATE TRIGGER trg_after_scheduled_career_match AFTER INSERT ON public.player_match_history FOR EACH ROW EXECUTE FUNCTION private.after_scheduled_career_match();

CREATE OR REPLACE FUNCTION public.record_career_match_gameplay(p_opponent text,p_competition text,p_played boolean,p_started boolean,p_minutes integer,p_goals integer,p_assists integer,p_rating numeric,p_team_goals integer,p_opponent_goals integer,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid();v_player uuid;v_state record;v_session record;v_result jsonb;v_match_id uuid;v_metadata jsonb;v_load jsonb;v_comp_result jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.';END IF;SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user LIMIT 1;IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player;SELECT * INTO v_session FROM private.career_match_sessions WHERE player_id=v_player AND match_date=v_state.career_date AND status='active' FOR UPDATE LIMIT 1;IF v_session.id IS NULL THEN RAISE EXCEPTION 'Sessão de partida ativa não encontrada.';END IF;IF coalesce(length(p_metadata::text),0)>40000 THEN RAISE EXCEPTION 'Dados da partida excedem o limite permitido.';END IF;IF p_started AND v_session.selection_status<>'starter' THEN RAISE EXCEPTION 'Escalação inconsistente com a sessão de partida.';END IF;IF NOT p_played AND(p_minutes<>0 OR p_goals<>0 OR p_assists<>0) THEN RAISE EXCEPTION 'Estatísticas incompatíveis com jogador sem participação.';END IF;
 v_load:=private.career_match_load(p_minutes,p_started,p_metadata);v_result:=public.record_career_match_result(p_opponent,p_competition,p_played,p_started,p_minutes,p_goals,p_assists,p_rating,p_team_goals,p_opponent_goals);v_match_id:=(v_result->>'match_id')::uuid;v_comp_result:=private.complete_player_competition_fixture(v_player,v_session.fixture_id,p_team_goals,p_opponent_goals,p_goals,p_assists,p_minutes,p_started,p_rating);
 v_metadata:=coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('engine','career-match-v4','session_id',v_session.id,'seed',v_session.seed,'fixture_id',v_session.fixture_id,'opponent_club_id',v_session.opponent_club_id,'selection_status',v_session.selection_status,'match_load',v_load,'competition_result',v_comp_result);UPDATE public.player_match_history SET metadata=metadata||v_metadata WHERE id=v_match_id AND player_id=v_player;UPDATE private.career_match_sessions SET status='completed',completed_at=now(),metadata=metadata||jsonb_build_object('match_id',v_match_id,'match_load',v_load,'competition_result',v_comp_result) WHERE id=v_session.id;
 IF p_played THEN UPDATE public.player_career_state SET energy=private.career_clamp(energy-coalesce((v_load->>'energy_loss')::int,0)),fatigue=private.career_clamp(fatigue+coalesce((v_load->>'fatigue_gain')::int,0)),pressure=private.career_clamp(pressure+CASE WHEN coalesce(p_rating,6)>=8 THEN -3 WHEN coalesce(p_rating,6)<5.5 THEN 3 ELSE 0 END),updated_at=now() WHERE player_id=v_player;END IF;PERFORM private.sync_competition_next_match(v_player);
 RETURN v_result||jsonb_build_object('session_id',v_session.id,'metadata_saved',true,'match_load',v_load,'competition_result',v_comp_result,'next_match_date',(SELECT next_match_date FROM public.player_career_state WHERE player_id=v_player));
END $$;
REVOKE ALL ON FUNCTION public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb) FROM public,anon;GRANT EXECUTE ON FUNCTION public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb) TO authenticated;

COMMIT;