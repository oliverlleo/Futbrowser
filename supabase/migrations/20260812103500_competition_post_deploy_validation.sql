BEGIN;

DO $$
DECLARE
  v_div integer;
  v_count integer;
  v_distinct_count integer;
  v_crest_count integer;
  v_bad_squad record;
  v_hub_def text;
  v_fixture_def text;
  v_gameplay_def text;
  v_reward_def text;
  v_sync_def text;
  v_offer_def text;
  v_roll_def text;
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
    SELECT count(*),count(DISTINCT short_name),count(*) FILTER(WHERE shield_url LIKE 'data:image/svg+xml;base64,%')
    INTO v_count,v_distinct_count,v_crest_count
    FROM public.base_clubs
    WHERE club_level='professional' AND division_level=v_div AND is_active;

    IF v_count <> 20 THEN
      RAISE EXCEPTION 'Competition deploy invalid: division % has % active clubs, expected 20.', v_div, v_count;
    END IF;
    IF v_distinct_count <> 20 THEN
      RAISE EXCEPTION 'Competition deploy invalid: division % does not have 20 distinct club abbreviations.', v_div;
    END IF;
    IF v_crest_count <> 20 THEN
      RAISE EXCEPTION 'Competition deploy invalid: division % does not have 20 generated club crests.', v_div;
    END IF;
  END LOOP;

  SELECT
    c.id,
    c.name,
    c.formation,
    count(p.id) AS players,
    count(*) FILTER(WHERE p.is_starter) AS starters,
    count(*) FILTER(WHERE p.is_starter AND p.primary_position='Goleiro') AS starter_gk,
    count(*) FILTER(WHERE p.is_starter AND p.primary_position='Volante') AS starter_dm,
    count(*) FILTER(WHERE p.is_starter AND p.primary_position='Atacante') AS starter_st,
    count(*) FILTER(WHERE p.is_starter AND p.primary_position IN('Ponta Direita','Ponta Esquerda','Atacante')) AS starter_attack,
    count(DISTINCT p.squad_number) AS shirt_numbers
  INTO v_bad_squad
  FROM public.base_clubs c
  JOIN public.base_ai_players p ON p.club_id=c.id
  WHERE c.club_level='professional' AND c.is_active
  GROUP BY c.id,c.name,c.formation
  HAVING count(p.id)<>22
      OR count(*) FILTER(WHERE p.is_starter)<>11
      OR count(*) FILTER(WHERE p.is_starter AND p.primary_position='Goleiro')<>1
      OR count(*) FILTER(WHERE p.is_starter AND p.primary_position IN('Ponta Direita','Ponta Esquerda','Atacante'))<3
      OR (c.formation='4-2-3-1' AND count(*) FILTER(WHERE p.is_starter AND p.primary_position='Volante')<>2)
      OR (c.formation='4-4-2' AND count(*) FILTER(WHERE p.is_starter AND p.primary_position='Atacante')<>2)
      OR count(DISTINCT p.squad_number)<>22
  LIMIT 1;

  IF v_bad_squad.id IS NOT NULL THEN
    RAISE EXCEPTION 'Competition deploy invalid: % (%) has players %, starters %, GK %, DMs %, STs %, attack %, unique shirts %.',
      v_bad_squad.name,v_bad_squad.formation,v_bad_squad.players,v_bad_squad.starters,
      v_bad_squad.starter_gk,v_bad_squad.starter_dm,v_bad_squad.starter_st,
      v_bad_squad.starter_attack,v_bad_squad.shirt_numbers;
  END IF;

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

  SELECT pg_get_functiondef('public.generate_initial_offers()'::regprocedure)
    INTO v_offer_def;
  IF position('club_level=''academy''' IN v_offer_def) = 0 THEN
    RAISE EXCEPTION 'Competition deploy invalid: professional clubs can leak into academy onboarding offers.';
  END IF;

  SELECT pg_get_functiondef('public.get_career_competition_hub(text,integer)'::regprocedure)
    INTO v_hub_def;
  IF position('private.academy_competition_level(v_player)' IN v_hub_def) = 0 THEN
    RAISE EXCEPTION 'Competition deploy invalid: academy hub is not age-aware.';
  END IF;

  SELECT pg_get_functiondef('private.roll_competition_world_if_needed(uuid)'::regprocedure)
    INTO v_roll_def;
  IF position('make_date(v_year+1,1,15)' IN v_roll_def) = 0 THEN
    RAISE EXCEPTION 'Competition deploy invalid: next season can start outside its calendar year.';
  END IF;

  SELECT pg_get_functiondef('private.complete_player_competition_fixture(uuid,uuid,integer,integer,integer,integer,integer,boolean,numeric)'::regprocedure)
    INTO v_fixture_def;
  IF position('CASE WHEN v_is_home AND p_started THEN 10 ELSE 11 END' IN v_fixture_def) = 0
     OR position('CASE WHEN NOT v_is_home AND p_started THEN 10 ELSE 11 END' IN v_fixture_def) = 0 THEN
    RAISE EXCEPTION 'Competition deploy invalid: user starter creates an invalid AI lineup count.';
  END IF;
  IF position(':uga:' IN v_fixture_def) = 0 OR position(':uoa:' IN v_fixture_def) = 0 THEN
    RAISE EXCEPTION 'Competition deploy invalid: AI assists are missing from user fixtures.';
  END IF;

  SELECT pg_get_functiondef('public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb)'::regprocedure)
    INTO v_gameplay_def;
  IF position('Estatísticas individuais incompatíveis com o placar.' IN v_gameplay_def) = 0
     OR position('Participação em campo exige minutos jogados.' IN v_gameplay_def) = 0 THEN
    RAISE EXCEPTION 'Competition deploy invalid: gameplay stat validation is incomplete.';
  END IF;

  SELECT pg_get_functiondef('private.finalize_competition_season(uuid)'::regprocedure)
    INTO v_reward_def;
  IF position('cash_balance=cash_balance+' IN v_reward_def) = 0
     OR position('SET cash=cash+' IN v_reward_def) > 0 THEN
    RAISE EXCEPTION 'Competition deploy invalid: rewards are not credited to cash_balance.';
  END IF;

  SELECT pg_get_functiondef('private.sync_competition_next_match(uuid)'::regprocedure)
    INTO v_sync_def;
  IF position('v_has_active_match' IN v_sync_def) = 0 THEN
    RAISE EXCEPTION 'Competition deploy invalid: active match calendar bridge is missing.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
