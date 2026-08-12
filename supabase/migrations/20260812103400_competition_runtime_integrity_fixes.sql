BEGIN;

-- The competition hub created in 1031 defaulted every academy career to U18.
-- After 1033 introduced age-aware U15/U17/U18/U20 worlds, keep the same RPC
-- signature but patch its default selector to the player's actual category.
DO $$
DECLARE
  v_def text;
  v_old text := 'ELSE v_code:=''ACA_U18_LEAGUE'';END IF;END IF;';
  v_new text := 'ELSE v_code:=''ACA_''||private.academy_competition_level(v_player)||''_LEAGUE'';END IF;END IF;';
BEGIN
  SELECT pg_get_functiondef('public.get_career_competition_hub(text,integer)'::regprocedure)
    INTO v_def;

  IF position(v_old IN v_def) > 0 THEN
    EXECUTE replace(v_def, v_old, v_new);
  ELSIF position('private.academy_competition_level(v_player)' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Não foi possível corrigir a categoria padrão da Central de Competições.';
  END IF;
END $$;

-- When the user starts, only ten AI players from his club should be registered
-- as starters. A substitute still leaves the eleven AI starters intact and is
-- recorded separately as an appearance from the bench.
DO $$
DECLARE
  v_def text;
  v_old text := 'PERFORM private.register_ai_lineup_stats(v_f.season_id,v_f.home_club_id);PERFORM private.register_ai_lineup_stats(v_f.season_id,v_f.away_club_id);';
  v_new text := 'PERFORM private.register_ai_lineup_stats(v_f.season_id,v_f.home_club_id,90,CASE WHEN v_is_home AND p_started THEN 10 ELSE 11 END);PERFORM private.register_ai_lineup_stats(v_f.season_id,v_f.away_club_id,90,CASE WHEN NOT v_is_home AND p_started THEN 10 ELSE 11 END);';
BEGIN
  SELECT pg_get_functiondef('private.complete_player_competition_fixture(uuid,uuid,integer,integer,integer,integer,integer,boolean,numeric)'::regprocedure)
    INTO v_def;

  IF position(v_old IN v_def) > 0 THEN
    EXECUTE replace(v_def, v_old, v_new);
  ELSIF position('CASE WHEN v_is_home AND p_started THEN 10 ELSE 11 END' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Não foi possível corrigir a contagem de titulares da competição.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
