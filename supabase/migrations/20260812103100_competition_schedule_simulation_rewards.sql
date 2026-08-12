BEGIN;

CREATE OR REPLACE FUNCTION private.ensure_division_map(p_player_id uuid,p_year integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.career_club_divisions WHERE player_id=p_player_id AND season_year=p_year) THEN RETURN; END IF;
  INSERT INTO public.career_club_divisions(player_id,season_year,club_id,division_level)
  SELECT p_player_id,p_year,c.id,c.division_level FROM public.base_clubs c
  WHERE c.club_level='professional' AND c.division_level BETWEEN 1 AND 4
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION private.generate_league_schedule(p_season_id uuid,p_start date,p_double boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_clubs uuid[];v_next uuid[];v_n int;v_round int;v_pair int;v_home uuid;v_away uuid;v_date date;v_legs int:=CASE WHEN p_double THEN 2 ELSE 1 END;
BEGIN
  IF EXISTS(SELECT 1 FROM public.career_competition_fixtures WHERE season_id=p_season_id) THEN RETURN; END IF;
  SELECT array_agg(club_id ORDER BY seed) INTO v_clubs FROM public.career_competition_entries WHERE season_id=p_season_id;
  v_n:=coalesce(array_length(v_clubs,1),0); IF v_n<2 OR mod(v_n,2)<>0 THEN RAISE EXCEPTION 'Liga exige número par de clubes: %',v_n; END IF;
  FOR v_round IN 1..(v_n-1) LOOP
    FOR v_pair IN 1..(v_n/2) LOOP
      v_home:=v_clubs[v_pair];v_away:=v_clubs[v_n-v_pair+1];
      IF mod(v_round+v_pair,2)=0 THEN v_home:=v_clubs[v_n-v_pair+1];v_away:=v_clubs[v_pair];END IF;
      v_date:=p_start+((v_round-1)*7)+mod(v_pair-1,3);
      INSERT INTO public.career_competition_fixtures(season_id,stage,round_number,leg,match_date,home_club_id,away_club_id,metadata)
      VALUES(p_season_id,'league',v_round,1,v_date,v_home,v_away,jsonb_build_object('scheduled_slot',v_pair));
      IF v_legs=2 THEN
        INSERT INTO public.career_competition_fixtures(season_id,stage,round_number,leg,match_date,home_club_id,away_club_id,metadata)
        VALUES(p_season_id,'league',v_round+(v_n-1),2,v_date+((v_n-1)*7),v_away,v_home,jsonb_build_object('scheduled_slot',v_pair));
      END IF;
    END LOOP;
    v_next:=ARRAY[v_clubs[1],v_clubs[v_n]]||v_clubs[2:v_n-1];v_clubs:=v_next;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.knockout_stage(p_teams integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT CASE p_teams WHEN 64 THEN 'round64' WHEN 32 THEN 'round32' WHEN 16 THEN 'round16' WHEN 8 THEN 'quarterfinal' WHEN 4 THEN 'semifinal' WHEN 2 THEN 'final' ELSE 'knockout' END $$;

CREATE OR REPLACE FUNCTION private.generate_knockout_schedule(p_season_id uuid,p_start date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_clubs uuid[];v_prev uuid[];v_next uuid[];v_count int;v_i int;v_round int:=1;v_id uuid;v_stage text;
BEGIN
  IF EXISTS(SELECT 1 FROM public.career_competition_fixtures WHERE season_id=p_season_id) THEN RETURN; END IF;
  SELECT array_agg(club_id ORDER BY seed) INTO v_clubs FROM public.career_competition_entries WHERE season_id=p_season_id;
  v_count:=coalesce(array_length(v_clubs,1),0);IF v_count<2 OR (v_count&(v_count-1))<>0 THEN RAISE EXCEPTION 'Mata-mata exige potência de 2: %',v_count;END IF;
  v_stage:=private.knockout_stage(v_count);v_prev:=ARRAY[]::uuid[];
  FOR v_i IN 1..(v_count/2) LOOP
    INSERT INTO public.career_competition_fixtures(season_id,stage,round_number,match_date,home_club_id,away_club_id,metadata)
    VALUES(p_season_id,v_stage,v_round,p_start+mod(v_i-1,3),v_clubs[v_i],v_clubs[v_count-v_i+1],jsonb_build_object('bracket_slot',v_i)) RETURNING id INTO v_id;
    v_prev:=array_append(v_prev,v_id);
  END LOOP;
  v_count:=v_count/2;
  WHILE v_count>=2 LOOP
    v_round:=v_round+1;v_stage:=private.knockout_stage(v_count);v_next:=ARRAY[]::uuid[];
    FOR v_i IN 1..(v_count/2) LOOP
      INSERT INTO public.career_competition_fixtures(season_id,stage,round_number,match_date,source_home_fixture_id,source_away_fixture_id,metadata)
      VALUES(p_season_id,v_stage,v_round,p_start+((v_round-1)*14)+mod(v_i-1,2),v_prev[(v_i*2)-1],v_prev[v_i*2],jsonb_build_object('bracket_slot',v_i)) RETURNING id INTO v_id;
      v_next:=array_append(v_next,v_id);
    END LOOP;
    v_prev:=v_next;v_count:=v_count/2;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.create_competition_season(p_player_id uuid,p_code text,p_year int,p_start date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_def record;v_season uuid;v_club record;v_seed int:=0;v_limit int;
BEGIN
  SELECT * INTO v_def FROM public.competition_definitions WHERE code=p_code AND is_active;IF v_def.code IS NULL THEN RAISE EXCEPTION 'Competição inválida: %',p_code;END IF;
  SELECT id INTO v_season FROM public.career_competition_seasons WHERE player_id=p_player_id AND competition_code=p_code AND season_year=p_year;
  IF v_season IS NOT NULL THEN RETURN v_season;END IF;
  INSERT INTO public.career_competition_seasons(player_id,competition_code,season_year,season_label,starts_on,status,metadata)
  VALUES(p_player_id,p_code,p_year,p_year::text,p_start,'active',jsonb_build_object('engine','competition-v1')) RETURNING id INTO v_season;
  IF v_def.career_stage='academy' THEN
    FOR v_club IN SELECT id FROM public.base_clubs WHERE club_level='academy' AND is_active ORDER BY CASE WHEN id=(SELECT club_id FROM public.player_career_state WHERE player_id=p_player_id) THEN 0 ELSE 1 END,club_code,name LIMIT v_def.team_count LOOP
      v_seed:=v_seed+1;INSERT INTO public.career_competition_entries(season_id,club_id,seed) VALUES(v_season,v_club.id,v_seed) ON CONFLICT DO NOTHING;
    END LOOP;
  ELSIF p_code='PRO_CUP' THEN
    PERFORM private.ensure_division_map(p_player_id,p_year);v_limit:=v_def.team_count;
    FOR v_club IN SELECT d.club_id FROM public.career_club_divisions d JOIN public.base_clubs c ON c.id=d.club_id WHERE d.player_id=p_player_id AND d.season_year=p_year ORDER BY CASE WHEN d.division_level<=3 THEN 0 ELSE 1 END,d.division_level,c.reputation DESC,c.club_code LIMIT v_limit LOOP
      v_seed:=v_seed+1;INSERT INTO public.career_competition_entries(season_id,club_id,seed) VALUES(v_season,v_club.club_id,v_seed) ON CONFLICT DO NOTHING;
    END LOOP;
  ELSE
    PERFORM private.ensure_division_map(p_player_id,p_year);
    FOR v_club IN SELECT d.club_id FROM public.career_club_divisions d JOIN public.base_clubs c ON c.id=d.club_id WHERE d.player_id=p_player_id AND d.season_year=p_year AND d.division_level=v_def.division_level ORDER BY c.reputation DESC,c.club_code LOOP
      v_seed:=v_seed+1;INSERT INTO public.career_competition_entries(season_id,club_id,seed) VALUES(v_season,v_club.club_id,v_seed) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  IF (SELECT count(*) FROM public.career_competition_entries WHERE season_id=v_season)<>v_def.team_count THEN RAISE EXCEPTION 'Competição % criada com número incorreto de clubes.',p_code;END IF;
  IF v_def.format='league' THEN PERFORM private.generate_league_schedule(v_season,p_start,v_def.double_round);ELSE PERFORM private.generate_knockout_schedule(v_season,p_start);END IF;
  SELECT max(match_date) INTO v_club FROM public.career_competition_fixtures WHERE season_id=v_season;
  UPDATE public.career_competition_seasons SET ends_on=(SELECT max(match_date) FROM public.career_competition_fixtures WHERE season_id=v_season) WHERE id=v_season;
  RETURN v_season;
END $$;

CREATE OR REPLACE FUNCTION private.ensure_competition_world(p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record;v_year int;v_start date;v_div int;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;IF v_state.player_id IS NULL THEN RETURN;END IF;
  v_year:=extract(year FROM v_state.career_date)::int;v_start:=greatest(v_state.career_date+2,coalesce(v_state.next_match_date,v_state.career_date+6));
  IF coalesce(v_state.career_stage,'academy')='academy' THEN
    PERFORM private.create_competition_season(p_player_id,'ACA_U18_LEAGUE',v_year,v_start);
    PERFORM private.create_competition_season(p_player_id,'ACA_U18_CUP',v_year,v_start+3);
  ELSE
    PERFORM private.ensure_division_map(p_player_id,v_year);
    PERFORM private.create_competition_season(p_player_id,'PRO_A',v_year,v_start);
    PERFORM private.create_competition_season(p_player_id,'PRO_B',v_year,v_start);
    PERFORM private.create_competition_season(p_player_id,'PRO_C',v_year,v_start);
    PERFORM private.create_competition_season(p_player_id,'PRO_D',v_year,v_start);
    PERFORM private.create_competition_season(p_player_id,'PRO_CUP',v_year,v_start+3);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.fixture_winner(p_fixture_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT CASE WHEN f.status<>'completed' THEN NULL WHEN coalesce(f.home_goals,0)>coalesce(f.away_goals,0) THEN f.home_club_id WHEN coalesce(f.away_goals,0)>coalesce(f.home_goals,0) THEN f.away_club_id WHEN coalesce(f.home_penalties,0)>coalesce(f.away_penalties,0) THEN f.home_club_id ELSE f.away_club_id END FROM public.career_competition_fixtures f WHERE f.id=p_fixture_id
$$;

CREATE OR REPLACE FUNCTION private.propagate_knockout_winner(p_fixture_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_winner uuid;
BEGIN
  v_winner:=private.fixture_winner(p_fixture_id);IF v_winner IS NULL THEN RETURN;END IF;
  UPDATE public.career_competition_fixtures SET home_club_id=v_winner WHERE source_home_fixture_id=p_fixture_id AND home_club_id IS NULL;
  UPDATE public.career_competition_fixtures SET away_club_id=v_winner WHERE source_away_fixture_id=p_fixture_id AND away_club_id IS NULL;
END $$;

CREATE OR REPLACE FUNCTION private.club_competition_strength(p_club_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT coalesce((SELECT avg(ovr) FROM public.base_ai_players WHERE club_id=p_club_id),(SELECT 45+reputation*6 FROM public.base_clubs WHERE id=p_club_id),60)
$$;

CREATE OR REPLACE FUNCTION private.simulated_goal_count(p_fixture_id uuid,p_side text,p_delta numeric,p_home boolean)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_roll int:=mod(abs(hashtext(p_fixture_id::text||':'||p_side)),1000);v_goal int;
BEGIN
 v_goal:=CASE WHEN v_roll<185 THEN 0 WHEN v_roll<525 THEN 1 WHEN v_roll<770 THEN 2 WHEN v_roll<910 THEN 3 WHEN v_roll<975 THEN 4 ELSE 5 END;
 IF p_delta>=10 AND mod(abs(hashtext(p_fixture_id::text||':'||p_side||':boost')),100)<50 THEN v_goal:=v_goal+1;END IF;
 IF p_delta<=-10 AND mod(abs(hashtext(p_fixture_id::text||':'||p_side||':nerf')),100)<45 THEN v_goal:=v_goal-1;END IF;
 IF p_home AND mod(abs(hashtext(p_fixture_id::text||':homeadv')),100)<22 THEN v_goal:=v_goal+1;END IF;
 RETURN greatest(0,least(6,v_goal));
END $$;

CREATE OR REPLACE FUNCTION private.add_ai_competition_stat(p_season uuid,p_club uuid,p_goal boolean,p_assist boolean,p_salt text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_ai record;
BEGIN
 SELECT ai.* INTO v_ai FROM public.base_ai_players ai WHERE ai.club_id=p_club ORDER BY (CASE ai.primary_position WHEN 'Atacante' THEN 20 WHEN 'Ponta Direita' THEN 15 WHEN 'Ponta Esquerda' THEN 15 WHEN 'Meia Direita' THEN 10 WHEN 'Meia Esquerda' THEN 10 ELSE 0 END)+ai.ovr DESC,md5(ai.id::text||p_salt) LIMIT 1;
 IF v_ai.id IS NULL THEN RETURN;END IF;
 INSERT INTO public.career_competition_player_stats(season_id,entity_key,club_id,ai_player_id,display_name,appearances,starts,minutes,goals,assists)
 VALUES(p_season,'ai:'||v_ai.id,p_club,v_ai.id,v_ai.name,1,1,90,CASE WHEN p_goal THEN 1 ELSE 0 END,CASE WHEN p_assist THEN 1 ELSE 0 END)
 ON CONFLICT(season_id,entity_key) DO UPDATE SET appearances=public.career_competition_player_stats.appearances+1,minutes=public.career_competition_player_stats.minutes+90,goals=public.career_competition_player_stats.goals+CASE WHEN p_goal THEN 1 ELSE 0 END,assists=public.career_competition_player_stats.assists+CASE WHEN p_assist THEN 1 ELSE 0 END;
END $$;

CREATE OR REPLACE FUNCTION private.competition_standings(p_season uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH games AS(
 SELECT home_club_id club_id,1 played,(home_goals>away_goals)::int wins,(home_goals=away_goals)::int draws,(home_goals<away_goals)::int losses,home_goals gf,away_goals ga FROM public.career_competition_fixtures WHERE season_id=p_season AND status='completed' AND stage='league'
 UNION ALL SELECT away_club_id,1,(away_goals>home_goals)::int,(away_goals=home_goals)::int,(away_goals<home_goals)::int,away_goals,home_goals FROM public.career_competition_fixtures WHERE season_id=p_season AND status='completed' AND stage='league'
),agg AS(SELECT e.club_id,coalesce(sum(g.played),0)::int played,coalesce(sum(g.wins),0)::int wins,coalesce(sum(g.draws),0)::int draws,coalesce(sum(g.losses),0)::int losses,coalesce(sum(g.gf),0)::int gf,coalesce(sum(g.ga),0)::int ga,coalesce(sum(g.wins)*3+sum(g.draws),0)::int points FROM public.career_competition_entries e LEFT JOIN games g ON g.club_id=e.club_id WHERE e.season_id=p_season GROUP BY e.club_id),ranked AS(SELECT a.*,c.name,c.short_name,c.shield_url,c.primary_color,c.secondary_color,row_number() OVER(ORDER BY points DESC,(gf-ga) DESC,gf DESC,wins DESC,c.name) position FROM agg a JOIN public.base_clubs c ON c.id=a.club_id)
SELECT coalesce(jsonb_agg(jsonb_build_object('position',position,'club_id',club_id,'name',name,'short_name',short_name,'crest',shield_url,'primary_color',primary_color,'secondary_color',secondary_color,'played',played,'wins',wins,'draws',draws,'losses',losses,'gf',gf,'ga',ga,'gd',gf-ga,'points',points) ORDER BY position),'[]'::jsonb) FROM ranked
$$;

CREATE OR REPLACE FUNCTION private.competition_leaders(p_season uuid,p_column text,p_limit int DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 IF p_column='assists' THEN SELECT coalesce(jsonb_agg(x.obj ORDER BY x.assists DESC,x.goals DESC,x.name),'[]'::jsonb) INTO v_result FROM(SELECT s.assists,s.goals,s.display_name name,jsonb_build_object('name',s.display_name,'club_id',s.club_id,'club',c.name,'crest',c.shield_url,'goals',s.goals,'assists',s.assists,'is_user',s.player_id IS NOT NULL) obj FROM public.career_competition_player_stats s JOIN public.base_clubs c ON c.id=s.club_id WHERE s.season_id=p_season ORDER BY s.assists DESC,s.goals DESC,s.display_name LIMIT p_limit)x;
 ELSE SELECT coalesce(jsonb_agg(x.obj ORDER BY x.goals DESC,x.assists DESC,x.name),'[]'::jsonb) INTO v_result FROM(SELECT s.goals,s.assists,s.display_name name,jsonb_build_object('name',s.display_name,'club_id',s.club_id,'club',c.name,'crest',c.shield_url,'goals',s.goals,'assists',s.assists,'is_user',s.player_id IS NOT NULL) obj FROM public.career_competition_player_stats s JOIN public.base_clubs c ON c.id=s.club_id WHERE s.season_id=p_season ORDER BY s.goals DESC,s.assists DESC,s.display_name LIMIT p_limit)x;END IF;RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION private.finalize_professional_pyramid(p_player uuid,p_year int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_div int;v_season uuid;v_slots int;v_club uuid;v_player_club uuid;v_old int;v_new int;
BEGIN
 IF (SELECT count(*) FROM public.career_competition_seasons WHERE player_id=p_player AND season_year=p_year AND competition_code IN('PRO_A','PRO_B','PRO_C','PRO_D') AND status='completed')<4 THEN RETURN;END IF;
 IF EXISTS(SELECT 1 FROM public.career_club_divisions WHERE player_id=p_player AND season_year=p_year+1) THEN RETURN;END IF;
 INSERT INTO public.career_club_divisions(player_id,season_year,club_id,division_level) SELECT player_id,p_year+1,club_id,division_level FROM public.career_club_divisions WHERE player_id=p_player AND season_year=p_year;
 FOR v_div IN 1..4 LOOP
   SELECT id INTO v_season FROM public.career_competition_seasons WHERE player_id=p_player AND season_year=p_year AND competition_code='PRO_'||chr(64+v_div);
   IF v_season IS NULL THEN CONTINUE;END IF;
   v_slots:=CASE WHEN v_div=1 THEN 0 ELSE 4 END;
   IF v_slots>0 THEN FOR v_club IN SELECT club_id FROM public.career_competition_entries WHERE season_id=v_season AND final_position<=v_slots LOOP UPDATE public.career_club_divisions SET division_level=v_div-1 WHERE player_id=p_player AND season_year=p_year+1 AND club_id=v_club;END LOOP;END IF;
   IF v_div<4 THEN FOR v_club IN SELECT club_id FROM public.career_competition_entries WHERE season_id=v_season AND final_position>(SELECT count(*)-4 FROM public.career_competition_entries WHERE season_id=v_season) LOOP UPDATE public.career_club_divisions SET division_level=v_div+1 WHERE player_id=p_player AND season_year=p_year+1 AND club_id=v_club;END LOOP;END IF;
 END LOOP;
 SELECT club_id INTO v_player_club FROM public.player_career_state WHERE player_id=p_player;SELECT division_level INTO v_old FROM public.career_club_divisions WHERE player_id=p_player AND season_year=p_year AND club_id=v_player_club;SELECT division_level INTO v_new FROM public.career_club_divisions WHERE player_id=p_player AND season_year=p_year+1 AND club_id=v_player_club;
 IF v_new<v_old THEN INSERT INTO public.career_competition_rewards(player_id,season_id,reward_type,title,amount,awarded_on,metadata) SELECT p_player,id,'promotion','Acesso conquistado',0,coalesce(ends_on,current_date),jsonb_build_object('from',v_old,'to',v_new) FROM public.career_competition_seasons WHERE player_id=p_player AND season_year=p_year AND competition_code='PRO_'||chr(64+v_old) ON CONFLICT DO NOTHING;END IF;
END $$;

CREATE OR REPLACE FUNCTION private.finalize_competition_season(p_season uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_s record;v_def record;v_stand jsonb;v_champion uuid;v_user uuid;v_user_club uuid;v_user_goals int:=0;v_user_assists int:=0;v_max_goals int:=0;v_max_assists int:=0;v_date date;v_item jsonb;v_pos int:=0;
BEGIN
 SELECT * INTO v_s FROM public.career_competition_seasons WHERE id=p_season FOR UPDATE;IF v_s.id IS NULL OR v_s.status='completed' THEN RETURN;END IF;SELECT * INTO v_def FROM public.competition_definitions WHERE code=v_s.competition_code;
 IF v_def.format='league' THEN IF EXISTS(SELECT 1 FROM public.career_competition_fixtures WHERE season_id=p_season AND status<>'completed') THEN RETURN;END IF;v_stand:=private.competition_standings(p_season);v_champion=(v_stand->0->>'club_id')::uuid;FOR v_item IN SELECT * FROM jsonb_array_elements(v_stand) LOOP v_pos:=v_pos+1;UPDATE public.career_competition_entries SET final_position=v_pos WHERE season_id=p_season AND club_id=(v_item->>'club_id')::uuid;END LOOP;
 ELSE SELECT private.fixture_winner(id) INTO v_champion FROM public.career_competition_fixtures WHERE season_id=p_season AND stage='final' AND status='completed' LIMIT 1;IF v_champion IS NULL THEN RETURN;END IF;END IF;
 v_date:=coalesce(v_s.ends_on,current_date);UPDATE public.career_competition_seasons SET status='completed',champion_club_id=v_champion,completed_at=now() WHERE id=p_season;
 v_user:=v_s.player_id;SELECT club_id INTO v_user_club FROM public.player_career_state WHERE player_id=v_user;SELECT coalesce(goals,0),coalesce(assists,0) INTO v_user_goals,v_user_assists FROM public.career_competition_player_stats WHERE season_id=p_season AND player_id=v_user LIMIT 1;SELECT coalesce(max(goals),0),coalesce(max(assists),0) INTO v_max_goals,v_max_assists FROM public.career_competition_player_stats WHERE season_id=p_season;
 IF v_champion=v_user_club THEN INSERT INTO public.career_competition_rewards(player_id,season_id,reward_type,title,amount,awarded_on) VALUES(v_user,p_season,'champion','Campeão · '||v_def.name,v_def.champion_reward,v_date) ON CONFLICT DO NOTHING;INSERT INTO public.player_honours(player_id,club_id,honour_type,career_stage,title,competition,season_label,awarded_on,metadata) VALUES(v_user,v_user_club,'team_title',v_def.career_stage,'Campeão · '||v_def.name,v_def.name,v_s.season_label,v_date,jsonb_build_object('competition_code',v_def.code)) ON CONFLICT DO NOTHING;UPDATE public.player_career_state SET cash=cash+v_def.champion_reward,fame=least(100,fame+CASE WHEN v_def.career_stage='academy' THEN 2 ELSE 5 END),fanbase=fanbase+CASE WHEN v_def.career_stage='academy' THEN 80 ELSE 800 END WHERE player_id=v_user;END IF;
 IF v_user_goals>0 AND v_user_goals=v_max_goals THEN INSERT INTO public.career_competition_rewards(player_id,season_id,reward_type,title,amount,awarded_on) VALUES(v_user,p_season,'top_scorer','Artilheiro · '||v_def.name,v_def.top_scorer_reward,v_date) ON CONFLICT DO NOTHING;INSERT INTO public.player_honours(player_id,club_id,honour_type,career_stage,title,competition,season_label,awarded_on,metadata) VALUES(v_user,v_user_club,'individual_award',v_def.career_stage,'Artilheiro · '||v_def.name,v_def.name,v_s.season_label,v_date,jsonb_build_object('goals',v_user_goals)) ON CONFLICT DO NOTHING;UPDATE public.player_career_state SET cash=cash+v_def.top_scorer_reward,fame=least(100,fame+3) WHERE player_id=v_user;END IF;
 IF v_user_assists>0 AND v_user_assists=v_max_assists THEN INSERT INTO public.career_competition_rewards(player_id,season_id,reward_type,title,amount,awarded_on) VALUES(v_user,p_season,'top_assists','Líder de assistências · '||v_def.name,v_def.top_assist_reward,v_date) ON CONFLICT DO NOTHING;INSERT INTO public.player_honours(player_id,club_id,honour_type,career_stage,title,competition,season_label,awarded_on,metadata) VALUES(v_user,v_user_club,'individual_award',v_def.career_stage,'Líder de assistências · '||v_def.name,v_def.name,v_s.season_label,v_date,jsonb_build_object('assists',v_user_assists)) ON CONFLICT DO NOTHING;UPDATE public.player_career_state SET cash=cash+v_def.top_assist_reward,fame=least(100,fame+2) WHERE player_id=v_user;END IF;
 IF v_def.career_stage='professional' AND v_def.format='league' THEN PERFORM private.finalize_professional_pyramid(v_user,v_s.season_year);END IF;
END $$;

CREATE OR REPLACE FUNCTION private.simulate_competition_fixture(p_fixture uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_f record;v_s record;v_home_strength numeric;v_away_strength numeric;v_h int;v_a int;v_i int;v_hp int;v_ap int;
BEGIN
 SELECT * INTO v_f FROM public.career_competition_fixtures WHERE id=p_fixture FOR UPDATE;IF v_f.id IS NULL OR v_f.status='completed' OR v_f.home_club_id IS NULL OR v_f.away_club_id IS NULL THEN RETURN;END IF;SELECT * INTO v_s FROM public.career_competition_seasons WHERE id=v_f.season_id;
 v_home_strength:=private.club_competition_strength(v_f.home_club_id);v_away_strength:=private.club_competition_strength(v_f.away_club_id);v_h:=private.simulated_goal_count(v_f.id,'h',v_home_strength-v_away_strength,true);v_a:=private.simulated_goal_count(v_f.id,'a',v_away_strength-v_home_strength,false);
 IF v_f.stage<>'league' AND v_h=v_a THEN v_hp:=3+mod(abs(hashtext(v_f.id::text||':hp')),4);v_ap:=3+mod(abs(hashtext(v_f.id::text||':ap')),4);IF v_hp=v_ap THEN IF mod(abs(hashtext(v_f.id::text||':pw')),2)=0 THEN v_hp:=v_hp+1;ELSE v_ap:=v_ap+1;END IF;END IF;END IF;
 UPDATE public.career_competition_fixtures SET status='completed',home_goals=v_h,away_goals=v_a,home_penalties=v_hp,away_penalties=v_ap,simulated_at=now() WHERE id=v_f.id;
 FOR v_i IN 1..v_h LOOP PERFORM private.add_ai_competition_stat(v_f.season_id,v_f.home_club_id,true,false,v_f.id::text||':hg:'||v_i);IF mod(abs(hashtext(v_f.id::text||':ha:'||v_i)),100)<72 THEN PERFORM private.add_ai_competition_stat(v_f.season_id,v_f.home_club_id,false,true,v_f.id::text||':ha:'||v_i);END IF;END LOOP;
 FOR v_i IN 1..v_a LOOP PERFORM private.add_ai_competition_stat(v_f.season_id,v_f.away_club_id,true,false,v_f.id::text||':ag:'||v_i);IF mod(abs(hashtext(v_f.id::text||':aa:'||v_i)),100)<72 THEN PERFORM private.add_ai_competition_stat(v_f.season_id,v_f.away_club_id,false,true,v_f.id::text||':aa:'||v_i);END IF;END LOOP;
 IF v_f.stage<>'league' THEN PERFORM private.propagate_knockout_winner(v_f.id);END IF;PERFORM private.finalize_competition_season(v_f.season_id);
END $$;

CREATE OR REPLACE FUNCTION private.simulate_due_competition_fixtures(p_player uuid,p_through date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_current_club uuid;v_f record;v_count int:=0;
BEGIN
 SELECT club_id INTO v_current_club FROM public.player_career_state WHERE player_id=p_player;
 FOR v_f IN SELECT f.id FROM public.career_competition_fixtures f JOIN public.career_competition_seasons s ON s.id=f.season_id WHERE s.player_id=p_player AND s.status<>'completed' AND f.status='scheduled' AND f.match_date<=p_through AND f.home_club_id IS NOT NULL AND f.away_club_id IS NOT NULL AND v_current_club NOT IN(f.home_club_id,f.away_club_id) ORDER BY f.match_date,f.id LOOP PERFORM private.simulate_competition_fixture(v_f.id);v_count:=v_count+1;END LOOP;RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION private.next_career_fixture(p_player uuid,p_after date DEFAULT NULL)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT f.id FROM public.career_competition_fixtures f JOIN public.career_competition_seasons s ON s.id=f.season_id JOIN public.player_career_state st ON st.player_id=p_player WHERE s.player_id=p_player AND s.status<>'completed' AND f.status='scheduled' AND (f.home_club_id=st.club_id OR f.away_club_id=st.club_id) AND f.home_club_id IS NOT NULL AND f.away_club_id IS NOT NULL AND (p_after IS NULL OR f.match_date>p_after) ORDER BY f.match_date,f.round_number LIMIT 1
$$;
CREATE OR REPLACE FUNCTION private.next_career_fixture_date(p_player uuid,p_after date DEFAULT NULL)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT match_date FROM public.career_competition_fixtures WHERE id=private.next_career_fixture(p_player,p_after) $$;

CREATE OR REPLACE FUNCTION private.after_competition_career_day()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.career_date IS DISTINCT FROM OLD.career_date THEN PERFORM private.ensure_competition_world(NEW.player_id);PERFORM private.simulate_due_competition_fixtures(NEW.player_id,NEW.career_date);END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_after_competition_career_day ON public.player_career_state;
CREATE TRIGGER trg_after_competition_career_day AFTER UPDATE OF career_date ON public.player_career_state FOR EACH ROW WHEN(OLD.career_date IS DISTINCT FROM NEW.career_date) EXECUTE FUNCTION private.after_competition_career_day();

CREATE OR REPLACE FUNCTION public.get_career_competition_hub(p_competition_code text DEFAULT NULL,p_round integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_player uuid;v_state record;v_club record;v_season record;v_code text;v_round int;v_competitions jsonb;v_round_matches jsonb;v_calendar jsonb;v_bracket jsonb;v_standings jsonb;v_scorers jsonb;v_assists jsonb;v_rewards jsonb;v_next jsonb;v_last_load jsonb;
BEGIN
 SELECT id INTO v_player FROM public.jogadores WHERE user_id=(SELECT auth.uid()) LIMIT 1;IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;PERFORM private.ensure_competition_world(v_player);SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player;PERFORM private.simulate_due_competition_fixtures(v_player,v_state.career_date);SELECT * INTO v_club FROM public.base_clubs WHERE id=v_state.club_id;
 v_code:=p_competition_code;IF v_code IS NULL THEN IF v_state.career_stage='professional' THEN SELECT 'PRO_'||chr(64+coalesce(d.division_level,v_club.division_level,4)) INTO v_code FROM public.career_club_divisions d WHERE d.player_id=v_player AND d.season_year=extract(year FROM v_state.career_date)::int AND d.club_id=v_state.club_id;v_code:=coalesce(v_code,'PRO_D');ELSE v_code:='ACA_U18_LEAGUE';END IF;END IF;
 SELECT s.*,d.name,d.short_name,d.format,d.division_level,d.promotion_slots,d.relegation_slots,d.champion_reward,d.top_scorer_reward,d.top_assist_reward INTO v_season FROM public.career_competition_seasons s JOIN public.competition_definitions d ON d.code=s.competition_code WHERE s.player_id=v_player AND s.competition_code=v_code ORDER BY s.season_year DESC LIMIT 1;IF v_season.id IS NULL THEN RAISE EXCEPTION 'Temporada não encontrada.';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('code',s.competition_code,'name',d.name,'short_name',d.short_name,'format',d.format,'division_level',d.division_level,'season_year',s.season_year,'status',s.status,'starts_on',s.starts_on,'ends_on',s.ends_on,'selected',s.id=v_season.id) ORDER BY d.display_order),'[]'::jsonb) INTO v_competitions FROM public.career_competition_seasons s JOIN public.competition_definitions d ON d.code=s.competition_code WHERE s.player_id=v_player AND s.season_year=v_season.season_year;
 v_round:=coalesce(p_round,(SELECT coalesce(min(round_number) FILTER(WHERE status='scheduled' AND match_date>=v_state.career_date),max(round_number),1) FROM public.career_competition_fixtures WHERE season_id=v_season.id));
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'round',f.round_number,'stage',f.stage,'leg',f.leg,'date',f.match_date,'status',f.status,'home',jsonb_build_object('id',h.id,'name',h.name,'short_name',h.short_name,'crest',h.shield_url),'away',jsonb_build_object('id',a.id,'name',a.name,'short_name',a.short_name,'crest',a.shield_url),'home_goals',f.home_goals,'away_goals',f.away_goals,'home_penalties',f.home_penalties,'away_penalties',f.away_penalties,'is_player_match',v_state.club_id IN(f.home_club_id,f.away_club_id)) ORDER BY f.match_date,f.id),'[]'::jsonb) INTO v_round_matches FROM public.career_competition_fixtures f LEFT JOIN public.base_clubs h ON h.id=f.home_club_id LEFT JOIN public.base_clubs a ON a.id=f.away_club_id WHERE f.season_id=v_season.id AND f.round_number=v_round;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'competition_code',s.competition_code,'competition',d.short_name,'round',f.round_number,'stage',f.stage,'date',f.match_date,'status',f.status,'home',jsonb_build_object('id',h.id,'name',h.name,'crest',h.shield_url),'away',jsonb_build_object('id',a.id,'name',a.name,'crest',a.shield_url),'home_goals',f.home_goals,'away_goals',f.away_goals,'home_penalties',f.home_penalties,'away_penalties',f.away_penalties) ORDER BY f.match_date,s.competition_code),'[]'::jsonb) INTO v_calendar FROM public.career_competition_fixtures f JOIN public.career_competition_seasons s ON s.id=f.season_id JOIN public.competition_definitions d ON d.code=s.competition_code LEFT JOIN public.base_clubs h ON h.id=f.home_club_id LEFT JOIN public.base_clubs a ON a.id=f.away_club_id WHERE s.player_id=v_player AND s.season_year=v_season.season_year AND v_state.club_id IN(f.home_club_id,f.away_club_id);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'stage',f.stage,'round',f.round_number,'date',f.match_date,'status',f.status,'home',jsonb_build_object('id',h.id,'name',h.name,'crest',h.shield_url),'away',jsonb_build_object('id',a.id,'name',a.name,'crest',a.shield_url),'home_goals',f.home_goals,'away_goals',f.away_goals,'home_penalties',f.home_penalties,'away_penalties',f.away_penalties) ORDER BY f.round_number,f.match_date,f.id),'[]'::jsonb) INTO v_bracket FROM public.career_competition_fixtures f LEFT JOIN public.base_clubs h ON h.id=f.home_club_id LEFT JOIN public.base_clubs a ON a.id=f.away_club_id WHERE f.season_id=v_season.id AND v_season.format='knockout';
 v_standings:=CASE WHEN v_season.format='league' THEN private.competition_standings(v_season.id) ELSE '[]'::jsonb END;v_scorers:=private.competition_leaders(v_season.id,'goals',10);v_assists:=private.competition_leaders(v_season.id,'assists',10);
 SELECT coalesce(jsonb_agg(jsonb_build_object('type',reward_type,'title',title,'amount',amount,'awarded_on',awarded_on) ORDER BY awarded_on DESC),'[]'::jsonb) INTO v_rewards FROM public.career_competition_rewards WHERE player_id=v_player AND season_id=v_season.id;
 SELECT jsonb_build_object('id',f.id,'date',f.match_date,'competition',d.short_name,'competition_code',s.competition_code,'stage',f.stage,'round',f.round_number,'home',jsonb_build_object('id',h.id,'name',h.name,'crest',h.shield_url),'away',jsonb_build_object('id',a.id,'name',a.name,'crest',a.shield_url)) INTO v_next FROM public.career_competition_fixtures f JOIN public.career_competition_seasons s ON s.id=f.season_id JOIN public.competition_definitions d ON d.code=s.competition_code LEFT JOIN public.base_clubs h ON h.id=f.home_club_id LEFT JOIN public.base_clubs a ON a.id=f.away_club_id WHERE f.id=private.next_career_fixture(v_player,v_state.career_date-1);
 SELECT metadata->'match_load' INTO v_last_load FROM public.player_match_history WHERE player_id=v_player AND context='club' ORDER BY match_date DESC,created_at DESC LIMIT 1;
 RETURN jsonb_build_object('career_date',v_state.career_date,'player_club',jsonb_build_object('id',v_club.id,'name',v_club.name,'crest',v_club.shield_url),'competitions',v_competitions,'selected',jsonb_build_object('code',v_season.competition_code,'name',v_season.name,'short_name',v_season.short_name,'format',v_season.format,'division_level',v_season.division_level,'season_year',v_season.season_year,'status',v_season.status,'current_round',v_round,'max_round',(SELECT max(round_number) FROM public.career_competition_fixtures WHERE season_id=v_season.id),'promotion_slots',v_season.promotion_slots,'relegation_slots',v_season.relegation_slots,'champion_reward',v_season.champion_reward,'top_scorer_reward',v_season.top_scorer_reward,'top_assist_reward',v_season.top_assist_reward),'round_fixtures',v_round_matches,'calendar',v_calendar,'bracket',v_bracket,'standings',v_standings,'leaders',jsonb_build_object('scorers',v_scorers,'assists',v_assists),'rewards',v_rewards,'next_fixture',v_next,'last_match_load',coalesce(v_last_load,'{}'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.get_career_competition_hub(text,integer) FROM public,anon;GRANT EXECUTE ON FUNCTION public.get_career_competition_hub(text,integer) TO authenticated;

COMMIT;