BEGIN;

ALTER TABLE public.player_career_state
  ADD COLUMN IF NOT EXISTS competition_priority text NOT NULL DEFAULT 'balanced'
  CHECK (competition_priority IN ('balanced','league','cup','development'));

CREATE OR REPLACE FUNCTION private.next_career_fixture(p_player uuid,p_after date DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT f.id
  FROM public.career_competition_fixtures f
  JOIN public.career_competition_seasons s ON s.id=f.season_id
  JOIN public.player_career_state st ON st.player_id=p_player
  WHERE s.player_id=p_player
    AND s.status<>'completed'
    AND f.status='scheduled'
    AND (f.home_club_id=st.club_id OR f.away_club_id=st.club_id)
    AND f.home_club_id IS NOT NULL
    AND f.away_club_id IS NOT NULL
    AND (p_after IS NULL OR f.match_date>p_after)
  ORDER BY
    CASE
      WHEN f.match_date<=coalesce(st.career_date,current_date)+3
       AND coalesce(st.competition_priority,'balanced')='cup'
       AND s.competition_code IN ('PRO_CUP','ACA_U18_CUP') THEN 0
      WHEN f.match_date<=coalesce(st.career_date,current_date)+3
       AND coalesce(st.competition_priority,'balanced')='league'
       AND s.competition_code NOT IN ('PRO_CUP','ACA_U18_CUP') THEN 0
      ELSE 1
    END,
    f.match_date,
    f.round_number,
    f.id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.set_career_competition_priority(p_priority text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_player uuid;
  v_priority text:=lower(trim(coalesce(p_priority,'')));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão expirada.'; END IF;
  IF v_priority NOT IN ('balanced','league','cup','development') THEN RAISE EXCEPTION 'Foco competitivo inválido.'; END IF;
  SELECT id INTO v_player FROM public.jogadores WHERE user_id=auth.uid() LIMIT 1;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  UPDATE public.player_career_state SET competition_priority=v_priority,updated_at=now() WHERE player_id=v_player;
  RETURN jsonb_build_object('success',true,'competition_priority',v_priority);
END;
$$;
REVOKE ALL ON FUNCTION public.set_career_competition_priority(text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.set_career_competition_priority(text) TO authenticated;

-- Corrige o hard-code de ACA_U18_LEAGUE: a carreira atual deve seguir o squad_level vigente.
CREATE OR REPLACE FUNCTION public.get_career_competition_hub(p_competition_code text DEFAULT NULL,p_round integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_player uuid;
  v_state record;
  v_club record;
  v_season record;
  v_code text;
  v_round int;
  v_competitions jsonb;
  v_round_matches jsonb;
  v_calendar jsonb;
  v_bracket jsonb;
  v_standings jsonb;
  v_scorers jsonb;
  v_assists jsonb;
  v_rewards jsonb;
  v_next jsonb;
  v_last_load jsonb;
  v_priority_copy text;
  v_squad_level text;
BEGIN
  SELECT id INTO v_player FROM public.jogadores WHERE user_id=auth.uid() LIMIT 1;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  PERFORM private.ensure_competition_world(v_player);
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player;
  PERFORM private.simulate_due_competition_fixtures(v_player,v_state.career_date);
  SELECT * INTO v_club FROM public.base_clubs WHERE id=v_state.club_id;
  v_code:=p_competition_code;
  IF v_code IS NULL THEN
    IF v_state.career_stage='professional' THEN
      SELECT 'PRO_'||chr(64+coalesce(d.division_level,v_club.division_level,4)) INTO v_code
      FROM public.career_club_divisions d
      WHERE d.player_id=v_player AND d.season_year=extract(year FROM v_state.career_date)::int AND d.club_id=v_state.club_id;
      v_code:=coalesce(v_code,'PRO_D');
    ELSE
      SELECT a.squad_level INTO v_squad_level
      FROM public.player_squad_assignments a
      WHERE a.player_id=v_player
        AND a.club_id=v_state.club_id
        AND a.started_on<=v_state.career_date
        AND (a.ended_on IS NULL OR a.ended_on>=v_state.career_date)
      ORDER BY a.started_on DESC
      LIMIT 1;
      v_code:=CASE v_squad_level
        WHEN 'u15' THEN 'ACA_U15_CUP'
        WHEN 'u17' THEN 'ACA_U17_LEAGUE'
        WHEN 'u18' THEN 'ACA_U18_LEAGUE'
        WHEN 'u20' THEN 'ACA_U20_LEAGUE'
        ELSE 'ACA_U17_LEAGUE'
      END;
    END IF;
  END IF;
  SELECT s.*,d.name,d.short_name,d.format,d.division_level,d.promotion_slots,d.relegation_slots,d.champion_reward,d.top_scorer_reward,d.top_assist_reward
  INTO v_season
  FROM public.career_competition_seasons s
  JOIN public.competition_definitions d ON d.code=s.competition_code
  WHERE s.player_id=v_player AND s.competition_code=v_code
  ORDER BY s.season_year DESC LIMIT 1;
  IF v_season.id IS NULL THEN RAISE EXCEPTION 'Temporada não encontrada.'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('code',s.competition_code,'name',d.name,'short_name',d.short_name,'format',d.format,'division_level',d.division_level,'season_year',s.season_year,'status',s.status,'starts_on',s.starts_on,'ends_on',s.ends_on,'selected',s.id=v_season.id) ORDER BY d.display_order),'[]'::jsonb)
  INTO v_competitions
  FROM public.career_competition_seasons s JOIN public.competition_definitions d ON d.code=s.competition_code
  WHERE s.player_id=v_player AND s.season_year=v_season.season_year;
  v_round:=coalesce(p_round,(SELECT coalesce(min(round_number) FILTER(WHERE status='scheduled' AND match_date>=v_state.career_date),max(round_number),1) FROM public.career_competition_fixtures WHERE season_id=v_season.id));
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'round',f.round_number,'stage',f.stage,'leg',f.leg,'date',f.match_date,'status',f.status,'home',jsonb_build_object('id',h.id,'name',h.name,'short_name',h.short_name,'crest',h.shield_url),'away',jsonb_build_object('id',a.id,'name',a.name,'short_name',a.short_name,'crest',a.shield_url),'home_goals',f.home_goals,'away_goals',f.away_goals,'home_penalties',f.home_penalties,'away_penalties',f.away_penalties,'is_player_match',v_state.club_id IN(f.home_club_id,f.away_club_id)) ORDER BY f.match_date,f.id),'[]'::jsonb)
  INTO v_round_matches
  FROM public.career_competition_fixtures f LEFT JOIN public.base_clubs h ON h.id=f.home_club_id LEFT JOIN public.base_clubs a ON a.id=f.away_club_id
  WHERE f.season_id=v_season.id AND f.round_number=v_round;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'competition_code',s.competition_code,'competition',d.short_name,'round',f.round_number,'stage',f.stage,'date',f.match_date,'status',f.status,'home',jsonb_build_object('id',h.id,'name',h.name,'crest',h.shield_url),'away',jsonb_build_object('id',a.id,'name',a.name,'crest',a.shield_url),'home_goals',f.home_goals,'away_goals',f.away_goals,'home_penalties',f.home_penalties,'away_penalties',f.away_penalties) ORDER BY f.match_date,s.competition_code),'[]'::jsonb)
  INTO v_calendar
  FROM public.career_competition_fixtures f JOIN public.career_competition_seasons s ON s.id=f.season_id JOIN public.competition_definitions d ON d.code=s.competition_code LEFT JOIN public.base_clubs h ON h.id=f.home_club_id LEFT JOIN public.base_clubs a ON a.id=f.away_club_id
  WHERE s.player_id=v_player AND s.season_year=v_season.season_year AND v_state.club_id IN(f.home_club_id,f.away_club_id);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'stage',f.stage,'round',f.round_number,'date',f.match_date,'status',f.status,'home',jsonb_build_object('id',h.id,'name',h.name,'crest',h.shield_url),'away',jsonb_build_object('id',a.id,'name',a.name,'crest',a.shield_url),'home_goals',f.home_goals,'away_goals',f.away_goals,'home_penalties',f.home_penalties,'away_penalties',f.away_penalties) ORDER BY f.round_number,f.match_date,f.id),'[]'::jsonb)
  INTO v_bracket
  FROM public.career_competition_fixtures f LEFT JOIN public.base_clubs h ON h.id=f.home_club_id LEFT JOIN public.base_clubs a ON a.id=f.away_club_id
  WHERE f.season_id=v_season.id AND v_season.format='knockout';
  v_standings:=CASE WHEN v_season.format='league' THEN private.competition_standings(v_season.id) ELSE '[]'::jsonb END;
  v_scorers:=private.competition_leaders(v_season.id,'goals',10);
  v_assists:=private.competition_leaders(v_season.id,'assists',10);
  SELECT coalesce(jsonb_agg(jsonb_build_object('type',reward_type,'title',title,'amount',amount,'awarded_on',awarded_on) ORDER BY awarded_on DESC),'[]'::jsonb) INTO v_rewards FROM public.career_competition_rewards WHERE player_id=v_player AND season_id=v_season.id;
  SELECT jsonb_build_object('id',f.id,'date',f.match_date,'competition',d.short_name,'competition_code',s.competition_code,'stage',f.stage,'round',f.round_number,'home',jsonb_build_object('id',h.id,'name',h.name,'crest',h.shield_url),'away',jsonb_build_object('id',a.id,'name',a.name,'crest',a.shield_url))
  INTO v_next
  FROM public.career_competition_fixtures f JOIN public.career_competition_seasons s ON s.id=f.season_id JOIN public.competition_definitions d ON d.code=s.competition_code LEFT JOIN public.base_clubs h ON h.id=f.home_club_id LEFT JOIN public.base_clubs a ON a.id=f.away_club_id
  WHERE f.id=private.next_career_fixture(v_player,v_state.career_date-1);
  SELECT metadata->'match_load' INTO v_last_load FROM public.player_match_history WHERE player_id=v_player AND context='club' ORDER BY match_date DESC,created_at DESC LIMIT 1;
  v_priority_copy:=CASE coalesce(v_state.competition_priority,'balanced') WHEN 'league' THEN 'A comissão está priorizando a liga e sua regularidade.' WHEN 'cup' THEN 'A comissão está priorizando a copa e seus jogos decisivos.' WHEN 'development' THEN 'A comissão está priorizando desenvolvimento e gestão de carga.' ELSE 'A comissão está equilibrando liga, copa e desenvolvimento.' END;
  RETURN jsonb_build_object('career_date',v_state.career_date,'player_club',jsonb_build_object('id',v_club.id,'name',v_club.name,'crest',v_club.shield_url),'competition_priority',coalesce(v_state.competition_priority,'balanced'),'competition_priority_copy',v_priority_copy,'competitions',v_competitions,'selected',jsonb_build_object('code',v_season.competition_code,'name',v_season.name,'short_name',v_season.short_name,'format',v_season.format,'division_level',v_season.division_level,'season_year',v_season.season_year,'status',v_season.status,'current_round',v_round,'max_round',(SELECT max(round_number) FROM public.career_competition_fixtures WHERE season_id=v_season.id),'promotion_slots',v_season.promotion_slots,'relegation_slots',v_season.relegation_slots,'champion_reward',v_season.champion_reward,'top_scorer_reward',v_season.top_scorer_reward,'top_assist_reward',v_season.top_assist_reward),'round_fixtures',v_round_matches,'calendar',v_calendar,'bracket',v_bracket,'standings',v_standings,'leaders',jsonb_build_object('scorers',v_scorers,'assists',v_assists),'rewards',v_rewards,'next_fixture',v_next,'last_match_load',coalesce(v_last_load,'{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.get_career_competition_hub(text,integer) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_career_competition_hub(text,integer) TO authenticated;

COMMIT;
