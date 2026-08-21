BEGIN;

ALTER TABLE public.manager_careers
  ADD COLUMN IF NOT EXISTS season_label text NOT NULL DEFAULT 'Temporada 2026/27',
  ADD COLUMN IF NOT EXISTS last_result jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.manager_fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_id uuid NOT NULL REFERENCES public.manager_careers(id) ON DELETE CASCADE,
  home_club_id uuid NOT NULL REFERENCES public.base_clubs(id) ON DELETE RESTRICT,
  away_club_id uuid NOT NULL REFERENCES public.base_clubs(id) ON DELETE RESTRICT,
  match_date date NOT NULL,
  competition text NOT NULL DEFAULT 'Liga Nacional',
  round_no integer NOT NULL CHECK (round_no BETWEEN 1 AND 38),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed')),
  home_goals integer CHECK (home_goals IS NULL OR home_goals BETWEEN 0 AND 20),
  away_goals integer CHECK (away_goals IS NULL OR away_goals BETWEEN 0 AND 20),
  approach text,
  match_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(career_id, round_no)
);
CREATE INDEX IF NOT EXISTS idx_manager_fixtures_next ON public.manager_fixtures(career_id, status, match_date, round_no);

CREATE TABLE IF NOT EXISTS public.manager_season_objectives (
  career_id uuid PRIMARY KEY REFERENCES public.manager_careers(id) ON DELETE CASCADE,
  season_label text NOT NULL,
  target_points integer NOT NULL DEFAULT 18 CHECK (target_points BETWEEN 1 AND 114),
  target_wins integer NOT NULL DEFAULT 5 CHECK (target_wins BETWEEN 0 AND 38),
  played integer NOT NULL DEFAULT 0 CHECK (played BETWEEN 0 AND 38),
  points integer NOT NULL DEFAULT 0 CHECK (points BETWEEN 0 AND 114),
  wins integer NOT NULL DEFAULT 0 CHECK (wins BETWEEN 0 AND 38),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','achieved','failed')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manager_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_season_objectives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.manager_fixtures FROM anon, authenticated;
REVOKE ALL ON TABLE public.manager_season_objectives FROM anon, authenticated;
GRANT SELECT ON TABLE public.manager_fixtures TO authenticated;
GRANT SELECT ON TABLE public.manager_season_objectives TO authenticated;
DROP POLICY IF EXISTS manager_fixtures_owner_select ON public.manager_fixtures;
CREATE POLICY manager_fixtures_owner_select ON public.manager_fixtures FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.manager_careers c WHERE c.id=manager_fixtures.career_id AND c.user_id=(select auth.uid())));
DROP POLICY IF EXISTS manager_objectives_owner_select ON public.manager_season_objectives;
CREATE POLICY manager_objectives_owner_select ON public.manager_season_objectives FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.manager_careers c WHERE c.id=manager_season_objectives.career_id AND c.user_id=(select auth.uid())));

CREATE OR REPLACE FUNCTION private.ensure_manager_schedule(p_career_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_career record;
  v_opponent uuid;
  v_round integer;
BEGIN
  SELECT * INTO v_career FROM public.manager_careers WHERE id=p_career_id AND status='active';
  IF v_career.id IS NULL THEN RETURN; END IF;
  FOR v_round IN 1..8 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.manager_fixtures f WHERE f.career_id=p_career_id AND f.round_no=v_round) THEN
      SELECT c.id INTO v_opponent
      FROM public.base_clubs c
      WHERE c.id<>v_career.club_id AND c.is_active IS TRUE AND c.club_level='professional'
      ORDER BY md5(c.id::text||':'||p_career_id::text||':'||v_round::text)
      LIMIT 1;
      IF v_opponent IS NOT NULL THEN
        INSERT INTO public.manager_fixtures(career_id,home_club_id,away_club_id,match_date,competition,round_no)
        VALUES(p_career_id,CASE WHEN mod(v_round,2)=1 THEN v_career.club_id ELSE v_opponent END,CASE WHEN mod(v_round,2)=1 THEN v_opponent ELSE v_career.club_id END,v_career.career_date+((v_round-1)*7),'Liga Nacional',v_round);
      END IF;
    END IF;
  END LOOP;
  INSERT INTO public.manager_season_objectives(career_id,season_label,target_points,target_wins)
  VALUES(p_career_id,v_career.season_label,18,5)
  ON CONFLICT(career_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_hub()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_uid uuid:=auth.uid();
  v_career public.manager_careers%ROWTYPE;
  v_profile jsonb;
  v_club jsonb;
  v_squad jsonb;
  v_next jsonb;
  v_schedule jsonb;
  v_recent jsonb;
  v_objective jsonb;
  v_record jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão expirada.'; END IF;
  SELECT * INTO v_career FROM public.manager_careers WHERE user_id=v_uid AND status='active';
  IF v_career.id IS NULL THEN RAISE EXCEPTION 'Nenhuma carreira Manager ativa.'; END IF;
  PERFORM private.ensure_manager_schedule(v_career.id);
  SELECT jsonb_build_object('id',p.id,'display_name',p.display_name,'nationality',p.nationality,'profile_type',p.profile_type,'reputation',p.reputation) INTO v_profile FROM public.manager_profiles p WHERE p.id=v_career.manager_profile_id;
  SELECT jsonb_build_object('id',c.id,'name',c.name,'short_name',c.short_name,'city',c.city,'shield_url',c.shield_url,'reputation',c.reputation,'division_level',c.division_level,'formation',v_career.formation,'play_style',v_career.play_style,'primary_color',c.primary_color,'secondary_color',c.secondary_color) INTO v_club FROM public.base_clubs c WHERE c.id=v_career.club_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.base_player_id,'name',s.display_name,'age',s.age,'primary_position',s.primary_position,'secondary_position',s.secondary_position,'ovr',s.ovr,'archetype',s.archetype,'squad_role',s.squad_role,'is_starter',s.is_starter,'squad_number',s.squad_number,'morale',s.morale,'fitness',s.fitness,'form',s.form,'monthly_wage',s.monthly_wage,'contract_seasons',s.contract_seasons,'transfer_status',s.transfer_status) ORDER BY s.is_starter DESC,s.ovr DESC,s.display_name),'[]'::jsonb) INTO v_squad FROM public.manager_squad_state s WHERE s.career_id=v_career.id AND s.club_id=v_career.club_id;
  SELECT jsonb_build_object('id',f.id,'date',f.match_date,'competition',f.competition,'round',f.round_no,'home',hc.name,'away',ac.name,'home_club_id',f.home_club_id,'away_club_id',f.away_club_id,'opponent',CASE WHEN f.home_club_id=v_career.club_id THEN ac.name ELSE hc.name END,'is_home',f.home_club_id=v_career.club_id,'status',f.status) INTO v_next FROM public.manager_fixtures f JOIN public.base_clubs hc ON hc.id=f.home_club_id JOIN public.base_clubs ac ON ac.id=f.away_club_id WHERE f.career_id=v_career.id AND f.status='scheduled' ORDER BY f.match_date,f.round_no LIMIT 1;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'date',f.match_date,'competition',f.competition,'round',f.round_no,'home',hc.name,'away',ac.name,'home_goals',f.home_goals,'away_goals',f.away_goals,'approach',f.approach,'report',f.match_report) ORDER BY f.match_date DESC,f.round_no DESC),'[]'::jsonb) INTO v_recent FROM public.manager_fixtures f JOIN public.base_clubs hc ON hc.id=f.home_club_id JOIN public.base_clubs ac ON ac.id=f.away_club_id WHERE f.career_id=v_career.id AND f.status='completed' LIMIT 5;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'date',f.match_date,'competition',f.competition,'round',f.round_no,'home',hc.name,'away',ac.name,'status',f.status,'home_goals',f.home_goals,'away_goals',f.away_goals) ORDER BY f.match_date,f.round_no),'[]'::jsonb) INTO v_schedule FROM public.manager_fixtures f JOIN public.base_clubs hc ON hc.id=f.home_club_id JOIN public.base_clubs ac ON ac.id=f.away_club_id WHERE f.career_id=v_career.id LIMIT 8;
  SELECT jsonb_build_object('season_label',o.season_label,'target_points',o.target_points,'target_wins',o.target_wins,'played',o.played,'points',o.points,'wins',o.wins,'status',o.status) INTO v_objective FROM public.manager_season_objectives o WHERE o.career_id=v_career.id;
  SELECT jsonb_build_object('played',count(*)::int,'wins',count(*) FILTER(WHERE (CASE WHEN f.home_club_id=v_career.club_id THEN f.home_goals ELSE f.away_goals END)>(CASE WHEN f.home_club_id=v_career.club_id THEN f.away_goals ELSE f.home_goals END))::int,'draws',count(*) FILTER(WHERE f.home_goals=f.away_goals)::int,'losses',count(*) FILTER(WHERE (CASE WHEN f.home_club_id=v_career.club_id THEN f.home_goals ELSE f.away_goals END)<(CASE WHEN f.home_club_id=v_career.club_id THEN f.away_goals ELSE f.home_goals END))::int,'goals_for',coalesce(sum(CASE WHEN f.home_club_id=v_career.club_id THEN f.home_goals ELSE f.away_goals END),0)::int,'goals_against',coalesce(sum(CASE WHEN f.home_club_id=v_career.club_id THEN f.away_goals ELSE f.home_goals END),0)::int) INTO v_record FROM public.manager_fixtures f WHERE f.career_id=v_career.id AND f.status='completed';
  RETURN jsonb_build_object('profile',v_profile,'career',jsonb_build_object('id',v_career.id,'status',v_career.status,'career_date',v_career.career_date,'season_label',v_career.season_label,'board_confidence',v_career.board_confidence,'locker_room_support',v_career.locker_room_support,'fan_approval',v_career.fan_approval,'media_pressure',v_career.media_pressure,'transfer_budget',v_career.transfer_budget,'wage_budget',v_career.wage_budget,'wage_committed',v_career.wage_committed,'formation',v_career.formation,'play_style',v_career.play_style,'training_focus',v_career.training_focus,'training_intensity',v_career.training_intensity,'last_result',coalesce(v_career.last_result,'{}'::jsonb),'record',coalesce(v_record,'{}'::jsonb)),'club',v_club,'squad',v_squad,'next_fixture',coalesce(v_next,'null'::jsonb),'objective',coalesce(v_objective,'{}'::jsonb),'schedule',v_schedule,'recent_matches',v_recent);
END;
$$;

CREATE OR REPLACE FUNCTION public.play_manager_match(p_approach text DEFAULT 'balanced')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_uid uuid:=auth.uid();
  v_career record;
  v_fixture record;
  v_approach text:=lower(trim(coalesce(p_approach,'balanced')));
  v_team_power numeric;
  v_opp_power numeric;
  v_margin numeric;
  v_home_chance integer;
  v_away_chance integer;
  v_home_goals integer:=0;
  v_away_goals integer:=0;
  v_i integer;
  v_is_home boolean;
  v_for integer;
  v_against integer;
  v_result text;
  v_points integer;
  v_report jsonb;
  v_hc text;
  v_ac text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão expirada.'; END IF;
  IF v_approach NOT IN ('cautious','balanced','aggressive','young_players') THEN RAISE EXCEPTION 'Plano de jogo inválido.'; END IF;
  SELECT * INTO v_career FROM public.manager_careers WHERE user_id=v_uid AND status='active' FOR UPDATE;
  IF v_career.id IS NULL THEN RAISE EXCEPTION 'Nenhuma carreira Manager ativa.'; END IF;
  PERFORM private.ensure_manager_schedule(v_career.id);
  SELECT f.*,hc.name home_name,ac.name away_name INTO v_fixture FROM public.manager_fixtures f JOIN public.base_clubs hc ON hc.id=f.home_club_id JOIN public.base_clubs ac ON ac.id=f.away_club_id WHERE f.career_id=v_career.id AND f.status='scheduled' ORDER BY f.match_date,f.round_no LIMIT 1 FOR UPDATE;
  IF v_fixture.id IS NULL THEN RAISE EXCEPTION 'Nenhuma partida disponível no calendário.'; END IF;
  IF v_fixture.match_date>v_career.career_date THEN RAISE EXCEPTION USING MESSAGE='A próxima partida só estará disponível em '||to_char(v_fixture.match_date,'DD/MM/YYYY')||'.'; END IF;
  SELECT coalesce(avg(s.ovr+((s.fitness-70)*.08)+((s.form-50)*.12)),55) INTO v_team_power FROM public.manager_squad_state s WHERE s.career_id=v_career.id AND s.is_starter;
  SELECT coalesce(avg(ai.ovr),55) INTO v_opp_power FROM public.base_ai_players ai WHERE ai.club_id=CASE WHEN v_fixture.home_club_id=v_career.club_id THEN v_fixture.away_club_id ELSE v_fixture.home_club_id END;
  v_margin:=v_team_power-v_opp_power+CASE v_approach WHEN 'aggressive' THEN 4 WHEN 'cautious' THEN -2 WHEN 'young_players' THEN -1 ELSE 0 END+CASE WHEN v_career.play_style='Ofensivo' THEN 3 WHEN v_career.play_style='Recuado' THEN -2 ELSE 0 END;
  v_home_chance:=greatest(8,least(78,round(34+((CASE WHEN v_fixture.home_club_id=v_career.club_id THEN v_margin ELSE -v_margin END)*1.5))::int));
  v_away_chance:=greatest(8,least(72,round(34+((CASE WHEN v_fixture.home_club_id=v_career.club_id THEN -v_margin ELSE v_margin END)*1.5))::int));
  FOR v_i IN 1..3 LOOP
    IF mod(abs(hashtext(v_fixture.id::text||':home:'||v_i::text)),100)<v_home_chance THEN v_home_goals:=v_home_goals+1; END IF;
    IF mod(abs(hashtext(v_fixture.id::text||':away:'||v_i::text)),100)<v_away_chance THEN v_away_goals:=v_away_goals+1; END IF;
  END LOOP;
  v_is_home:=v_fixture.home_club_id=v_career.club_id;
  v_for:=CASE WHEN v_is_home THEN v_home_goals ELSE v_away_goals END;
  v_against:=CASE WHEN v_is_home THEN v_away_goals ELSE v_home_goals END;
  v_result:=CASE WHEN v_for>v_against THEN 'VITÓRIA' WHEN v_for=v_against THEN 'EMPATE' ELSE 'DERROTA' END;
  v_points:=CASE WHEN v_for>v_against THEN 3 WHEN v_for=v_against THEN 1 ELSE 0 END;
  v_hc:=v_fixture.home_name;v_ac:=v_fixture.away_name;
  v_report:=jsonb_build_object('result',v_result,'score',jsonb_build_object('home',v_home_goals,'away',v_away_goals),'for',v_for,'against',v_against,'approach',v_approach,'team_power',round(v_team_power,1),'opponent_power',round(v_opp_power,1),'margin',round(v_margin,1),'summary',CASE WHEN v_result='VITÓRIA' THEN 'O plano foi executado e a equipe transformou sua preparação em resultado.' WHEN v_result='EMPATE' THEN 'A equipe competiu, mas faltou uma última vantagem para decidir a partida.' ELSE 'O adversário encontrou respostas; a comissão espera ajustes no próximo treino.' END);
  UPDATE public.manager_fixtures SET status='completed',home_goals=v_home_goals,away_goals=v_away_goals,approach=v_approach,match_report=v_report,completed_at=now() WHERE id=v_fixture.id;
  UPDATE public.manager_squad_state SET fitness=GREATEST(0,LEAST(100,fitness-CASE WHEN is_starter THEN CASE v_approach WHEN 'aggressive' THEN 18 WHEN 'cautious' THEN 9 ELSE 13 END ELSE 4 END)),form=GREATEST(0,LEAST(100,form+CASE WHEN is_starter AND v_result='VITÓRIA' THEN 4 WHEN is_starter AND v_result='DERROTA' THEN -3 ELSE 0 END)),morale=GREATEST(0,LEAST(100,morale+CASE WHEN v_result='VITÓRIA' THEN 3 WHEN v_result='DERROTA' THEN -3 ELSE 0 END)),updated_at=now() WHERE career_id=v_career.id;
  UPDATE public.manager_season_objectives SET played=played+1,points=points+v_points,wins=wins+CASE WHEN v_result='VITÓRIA' THEN 1 ELSE 0 END,status=CASE WHEN points+v_points>=target_points OR wins+CASE WHEN v_result='VITÓRIA' THEN 1 ELSE 0 END>=target_wins THEN 'achieved' ELSE status END,updated_at=now() WHERE career_id=v_career.id;
  UPDATE public.manager_profiles SET reputation=GREATEST(0,LEAST(100,reputation+CASE WHEN v_result='VITÓRIA' THEN 3 WHEN v_result='EMPATE' THEN 1 ELSE -1 END)),updated_at=now() WHERE id=v_career.manager_profile_id;
  UPDATE public.manager_careers SET career_date=GREATEST(career_date,v_fixture.match_date+7),board_confidence=GREATEST(0,LEAST(100,board_confidence+CASE WHEN v_result='VITÓRIA' THEN 5 WHEN v_result='EMPATE' THEN 1 ELSE -5 END)),locker_room_support=GREATEST(0,LEAST(100,locker_room_support+CASE WHEN v_result='VITÓRIA' THEN 3 WHEN v_result='EMPATE' THEN 0 ELSE -3 END)),fan_approval=GREATEST(0,LEAST(100,fan_approval+CASE WHEN v_result='VITÓRIA' THEN 5 WHEN v_result='EMPATE' THEN 1 ELSE -4 END)),media_pressure=GREATEST(0,LEAST(100,media_pressure+CASE WHEN v_result='VITÓRIA' THEN -3 WHEN v_result='DERROTA' THEN 6 ELSE 0 END)),last_result=v_report,updated_at=now() WHERE id=v_career.id;
  PERFORM private.ensure_manager_schedule(v_career.id);
  RETURN public.get_manager_hub()||jsonb_build_object('match_result',v_report,'message',v_result||' · '||v_hc||' '||v_home_goals||' × '||v_away_goals||' '||v_ac);
END;
$$;

REVOKE ALL ON FUNCTION public.play_manager_match(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.play_manager_match(text) TO authenticated;

COMMIT;
