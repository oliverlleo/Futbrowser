BEGIN;

CREATE OR REPLACE FUNCTION private.competition_season_max_age(p_season uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT CASE lower(coalesce(d.age_level,''))
    WHEN 'u15' THEN 15
    WHEN 'u17' THEN 17
    WHEN 'u18' THEN 18
    WHEN 'u20' THEN 20
    ELSE 99
  END
  FROM public.career_competition_seasons s
  JOIN public.competition_definitions d ON d.code=s.competition_code
  WHERE s.id=p_season
$$;

CREATE OR REPLACE FUNCTION private.current_fixture_max_age(p_player uuid,p_date date,p_club uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT coalesce((
    SELECT CASE lower(coalesce(d.age_level,''))
      WHEN 'u15' THEN 15
      WHEN 'u17' THEN 17
      WHEN 'u18' THEN 18
      WHEN 'u20' THEN 20
      ELSE 99
    END
    FROM public.career_competition_fixtures f
    JOIN public.career_competition_seasons s ON s.id=f.season_id
    JOIN public.competition_definitions d ON d.code=s.competition_code
    WHERE s.player_id=p_player
      AND f.match_date=p_date
      AND p_club IN(f.home_club_id,f.away_club_id)
    ORDER BY CASE WHEN s.competition_code LIKE '%CUP%' THEN 0 ELSE 1 END,f.round_number
    LIMIT 1
  ),99)
$$;

CREATE OR REPLACE FUNCTION private.season_club_competition_strength(p_season uuid,p_club uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT coalesce(
    (SELECT avg(ai.ovr)
     FROM public.base_ai_players ai
     WHERE ai.club_id=p_club
       AND ai.age<=coalesce(private.competition_season_max_age(p_season),99)),
    (SELECT 45+c.reputation*6 FROM public.base_clubs c WHERE c.id=p_club),
    60
  )
$$;

-- Make NPC result simulation use only players eligible for that competition.
DO $$
DECLARE
  v_def text;
  v_old text := 'v_home_strength:=private.club_competition_strength(v_f.home_club_id);v_away_strength:=private.club_competition_strength(v_f.away_club_id);';
  v_new text := 'v_home_strength:=private.season_club_competition_strength(v_f.season_id,v_f.home_club_id);v_away_strength:=private.season_club_competition_strength(v_f.season_id,v_f.away_club_id);';
BEGIN
  SELECT pg_get_functiondef('private.simulate_competition_fixture(uuid)'::regprocedure)
    INTO v_def;
  IF position(v_old IN v_def)>0 THEN
    EXECUTE replace(v_def,v_old,v_new);
  ELSIF position('private.season_club_competition_strength' IN v_def)=0 THEN
    RAISE EXCEPTION 'Não foi possível tornar a força simulada elegível por idade.';
  END IF;
END $$;

-- Lineup statistics must not register over-age academy players as starters.
DO $$
DECLARE
  v_def text;
  v_old text := 'WHERE ai.club_id=p_club ORDER BY ai.is_starter DESC,ai.ovr DESC,ai.id LIMIT p_limit';
  v_new text := 'WHERE ai.club_id=p_club AND ai.age<=coalesce(private.competition_season_max_age(p_season),99) ORDER BY ai.is_starter DESC,ai.ovr DESC,ai.id LIMIT p_limit';
BEGIN
  SELECT pg_get_functiondef('private.register_ai_lineup_stats(uuid,uuid,integer,integer)'::regprocedure)
    INTO v_def;
  IF position(v_old IN v_def)>0 THEN
    EXECUTE replace(v_def,v_old,v_new);
  ELSIF position('private.competition_season_max_age(p_season)' IN v_def)=0 THEN
    RAISE EXCEPTION 'Não foi possível filtrar a escalação estatística por idade.';
  END IF;
END $$;

-- Goal/assist attribution must use the same eligible population.
DO $$
DECLARE
  v_def text;
  v_old text := 'WHERE ai.club_id=p_club ORDER BY (CASE ai.primary_position';
  v_new text := 'WHERE ai.club_id=p_club AND ai.age<=coalesce(private.competition_season_max_age(p_season),99) ORDER BY (CASE ai.primary_position';
BEGIN
  SELECT pg_get_functiondef('private.add_ai_competition_stat(uuid,uuid,boolean,boolean,text)'::regprocedure)
    INTO v_def;
  IF position(v_old IN v_def)>0 THEN
    EXECUTE replace(v_def,v_old,v_new);
  ELSIF position('private.competition_season_max_age(p_season)' IN v_def)=0 THEN
    RAISE EXCEPTION 'Não foi possível filtrar gols/assistências de IA por idade.';
  END IF;
END $$;

-- The match context receives the real opponent roster; restrict it to players
-- eligible for the fixture's youth category. Professional fixtures cap at 99.
DO $$
DECLARE
  v_def text;
  v_old text := 'WHERE ai.club_id=v_opp.id';
  v_new text := 'WHERE ai.club_id=v_opp.id AND ai.age<=private.current_fixture_max_age(v_player.id,v_state.career_date,v_club.id)';
BEGIN
  SELECT pg_get_functiondef('public.get_career_match_context()'::regprocedure)
    INTO v_def;
  IF position(v_old IN v_def)>0 THEN
    EXECUTE replace(v_def,v_old,v_new);
  ELSIF position('private.current_fixture_max_age(v_player.id,v_state.career_date,v_club.id)' IN v_def)=0 THEN
    RAISE EXCEPTION 'Não foi possível filtrar o elenco adversário pela categoria.';
  END IF;
END $$;

-- The user's AI teammates are sourced from get_career_team_profile(), whose
-- roster JSON already carries age. Filter only the match-context copy so the
-- club/profile screen may still show the complete academy squad.
DO $$
DECLARE
  v_def text;
  v_old text := 'WHERE COALESCE(e->>''availability_status'',''available'')<>''out''';
  v_new text := 'WHERE COALESCE(e->>''availability_status'',''available'')<>''out'' AND COALESCE(NULLIF(e->>''age'','''')::integer,99)<=private.current_fixture_max_age(v_player.id,v_state.career_date,v_club.id)';
BEGIN
  SELECT pg_get_functiondef('public.get_career_match_context()'::regprocedure)
    INTO v_def;
  IF position(v_old IN v_def)>0 THEN
    EXECUTE replace(v_def,v_old,v_new);
  ELSIF position('COALESCE(NULLIF(e->>''age'','''')::integer,99)<=private.current_fixture_max_age' IN v_def)=0 THEN
    RAISE EXCEPTION 'Não foi possível filtrar os companheiros pela categoria.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
