BEGIN;

DO $$
DECLARE
  v_div integer;
  v_count integer;
  v_hub_def text;
  v_fixture_def text;
BEGIN
  IF to_regprocedure('public.bootstrap_career_competitions()') IS NULL THEN
    RAISE EXCEPTION 'Competition deploy invalid: bootstrap_career_competitions() missing.';
  END IF;

  IF to_regprocedure('public.get_career_competition_hub(text,integer)') IS NULL THEN
    RAISE EXCEPTION 'Competition deploy invalid: get_career_competition_hub(text,integer) missing.';
  END IF;

  IF to_regprocedure('public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Competition deploy invalid: record_career_match_gameplay(...) missing.';
  END IF;

  IF to_regclass('public.career_competition_fixtures') IS NULL
     OR to_regclass('public.career_competition_player_stats') IS NULL
     OR to_regclass('public.career_competition_rewards') IS NULL THEN
    RAISE EXCEPTION 'Competition deploy invalid: competition persistence tables missing.';
  END IF;

  FOREACH v_div IN ARRAY ARRAY[1,2,3,4] LOOP
    SELECT count(*) INTO v_count
    FROM public.base_clubs
    WHERE club_level='professional' AND division_level=v_div AND is_active;

    IF v_count <> 20 THEN
      RAISE EXCEPTION 'Competition deploy invalid: division % has % active clubs, expected 20.', v_div, v_count;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_count
  FROM public.competition_definitions
  WHERE code IN (
    'ACA_U15_LEAGUE','ACA_U15_CUP',
    'ACA_U17_LEAGUE','ACA_U17_CUP',
    'ACA_U18_LEAGUE','ACA_U18_CUP',
    'ACA_U20_LEAGUE','ACA_U20_CUP',
    'PRO_A','PRO_B','PRO_C','PRO_D','PRO_CUP'
  ) AND is_active;

  IF v_count <> 13 THEN
    RAISE EXCEPTION 'Competition deploy invalid: only % of 13 required competitions are active.', v_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.career_competition_seasons
    WHERE ends_on IS NULL
  ) THEN
    RAISE EXCEPTION 'Competition deploy invalid: generated season without final calendar date.';
  END IF;

  SELECT pg_get_functiondef('public.get_career_competition_hub(text,integer)'::regprocedure)
    INTO v_hub_def;
  IF position('private.academy_competition_level(v_player)' IN v_hub_def) = 0 THEN
    RAISE EXCEPTION 'Competition deploy invalid: academy hub is not age-aware.';
  END IF;

  SELECT pg_get_functiondef('private.complete_player_competition_fixture(uuid,uuid,integer,integer,integer,integer,integer,boolean,numeric)'::regprocedure)
    INTO v_fixture_def;
  IF position('CASE WHEN v_is_home AND p_started THEN 10 ELSE 11 END' IN v_fixture_def) = 0
     OR position('CASE WHEN NOT v_is_home AND p_started THEN 10 ELSE 11 END' IN v_fixture_def) = 0 THEN
    RAISE EXCEPTION 'Competition deploy invalid: user starter creates an invalid AI lineup count.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
