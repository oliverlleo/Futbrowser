BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_player_honours_identity
ON public.player_honours(
  player_id,honour_type,career_stage,
  coalesce(national_level,''),coalesce(club_id,'00000000-0000-0000-0000-000000000000'::uuid),
  title,coalesce(competition,''),awarded_on
);

CREATE OR REPLACE FUNCTION private.record_player_team_title(
  p_player_id uuid,
  p_title text,
  p_competition text,
  p_date date,
  p_stage text,
  p_club_id uuid DEFAULT NULL,
  p_level text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_stage NOT IN ('academy','professional','national') THEN RAISE EXCEPTION 'Fase inválida.'; END IF;
  IF p_stage='national' AND p_level NOT IN ('u15','u17','u20','senior') THEN RAISE EXCEPTION 'Categoria de seleção inválida.'; END IF;
  INSERT INTO public.player_honours(player_id,club_id,honour_type,career_stage,national_level,title,competition,season_label,awarded_on)
  VALUES(p_player_id,p_club_id,'team_title',p_stage,p_level,left(trim(p_title),120),left(trim(p_competition),120),private.current_season_label(p_date),p_date)
  ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.player_honours
    WHERE player_id=p_player_id AND honour_type='team_title' AND career_stage=p_stage
      AND national_level IS NOT DISTINCT FROM p_level AND club_id IS NOT DISTINCT FROM p_club_id
      AND title=left(trim(p_title),120) AND competition IS NOT DISTINCT FROM left(trim(p_competition),120) AND awarded_on=p_date
    LIMIT 1;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.record_player_individual_award(
  p_player_id uuid,
  p_title text,
  p_competition text,
  p_date date,
  p_stage text,
  p_club_id uuid DEFAULT NULL,
  p_level text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_stage NOT IN ('academy','professional','national') THEN RAISE EXCEPTION 'Fase inválida.'; END IF;
  IF p_stage='national' AND p_level NOT IN ('u15','u17','u20','senior') THEN RAISE EXCEPTION 'Categoria de seleção inválida.'; END IF;
  INSERT INTO public.player_honours(player_id,club_id,honour_type,career_stage,national_level,title,competition,season_label,awarded_on,metadata)
  VALUES(p_player_id,p_club_id,'individual_award',p_stage,p_level,left(trim(p_title),120),left(trim(p_competition),120),private.current_season_label(p_date),p_date,coalesce(p_metadata,'{}'::jsonb))
  ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.player_honours
    WHERE player_id=p_player_id AND honour_type='individual_award' AND career_stage=p_stage
      AND national_level IS NOT DISTINCT FROM p_level AND club_id IS NOT DISTINCT FROM p_club_id
      AND title=left(trim(p_title),120) AND competition IS NOT DISTINCT FROM left(trim(p_competition),120) AND awarded_on=p_date
    LIMIT 1;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.player_history_payload(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_stage text;
  v_honours jsonb;
  v_callups jsonb;
  v_seasons jsonb;
BEGIN
  SELECT career_stage INTO v_stage FROM public.player_career_state WHERE player_id=p_player_id;
  v_stage:=coalesce(v_stage,'academy');

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',h.id,'honour_type',h.honour_type,'career_stage',h.career_stage,
    'level',h.national_level,'title',h.title,'competition',h.competition,
    'season_label',h.season_label,'awarded_on',h.awarded_on,'club_name',c.name
  ) ORDER BY h.awarded_on DESC),'[]'::jsonb)
  INTO v_honours
  FROM public.player_honours h
  LEFT JOIN public.base_clubs c ON c.id=h.club_id
  WHERE h.player_id=p_player_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'level',n.level,'callup_date',n.callup_date,'release_date',n.release_date,
    'competition',n.competition,'reason',n.reason,'status',n.status
  ) ORDER BY n.callup_date DESC),'[]'::jsonb)
  INTO v_callups
  FROM public.player_national_callups n
  WHERE n.player_id=p_player_id;

  SELECT coalesce(jsonb_agg(x.row_data ORDER BY x.sort_date DESC),'[]'::jsonb)
  INTO v_seasons
  FROM (
    SELECT max(m.match_date) sort_date,
           jsonb_build_object(
             'season_label',m.season_label,
             'career_stage',m.career_stage,
             'context',m.context,
             'level',m.national_level,
             'club_id',m.club_id,
             'club_name',max(c.name),
             'games',count(*) FILTER (WHERE m.appeared),
             'starts',count(*) FILTER (WHERE m.appeared AND m.started),
             'goals',coalesce(sum(m.goals) FILTER (WHERE m.appeared),0),
             'assists',coalesce(sum(m.assists) FILTER (WHERE m.appeared),0),
             'wins',count(*) FILTER (WHERE m.appeared AND m.result='W'),
             'draws',count(*) FILTER (WHERE m.appeared AND m.result='D'),
             'losses',count(*) FILTER (WHERE m.appeared AND m.result='L')
           ) row_data
    FROM public.player_match_history m
    LEFT JOIN public.base_clubs c ON c.id=m.club_id
    WHERE m.player_id=p_player_id
    GROUP BY m.season_label,m.career_stage,m.context,m.national_level,m.club_id
  ) x;

  RETURN jsonb_build_object(
    'current_stage',v_stage,
    'stages',jsonb_build_object(
      'academy',private.career_match_stats(p_player_id,'academy','club',NULL),
      'professional',private.career_match_stats(p_player_id,'professional','club',NULL)
    ),
    'national',jsonb_build_object(
      'u15',private.career_match_stats(p_player_id,'national','national_team','u15'),
      'u17',private.career_match_stats(p_player_id,'national','national_team','u17'),
      'u20',private.career_match_stats(p_player_id,'national','national_team','u20'),
      'senior',private.career_match_stats(p_player_id,'national','national_team','senior')
    ),
    'national_total',private.career_match_stats(p_player_id,'national','national_team',NULL),
    'honours',v_honours,
    'callups',v_callups,
    'seasons',v_seasons
  );
END;
$$;

-- O navegador só pode LER o histórico. O resultado da partida será gravado pelo
-- motor server-side quando a mecânica da partida for ligada.
REVOKE EXECUTE ON FUNCTION public.record_career_match_result(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_national_team_match_result(text,text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer) FROM authenticated;

COMMIT;
