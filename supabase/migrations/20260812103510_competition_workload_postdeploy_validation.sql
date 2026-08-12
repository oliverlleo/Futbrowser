BEGIN;

DO $$
DECLARE
  v_def text;
  v_probe jsonb;
BEGIN
  IF to_regprocedure('private.career_match_load(integer,boolean,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Competition deploy invalid: career_match_load(...) missing.';
  END IF;

  SELECT pg_get_functiondef('private.career_match_load(integer,boolean,jsonb)'::regprocedure)
    INTO v_def;
  IF position('Sem carga' IN v_def)=0 THEN
    RAISE EXCEPTION 'Competition deploy invalid: zero-minute workload guard missing.';
  END IF;

  v_probe:=private.career_match_load(0,false,'{"player_stats":{}}'::jsonb);
  IF coalesce((v_probe->>'energy_loss')::integer,-1)<>0
     OR coalesce((v_probe->>'fatigue_gain')::integer,-1)<>0
     OR coalesce((v_probe->>'recovery_days')::integer,-1)<>0 THEN
    RAISE EXCEPTION 'Competition deploy invalid: zero-minute match still produces physical load: %',v_probe;
  END IF;
END $$;

COMMIT;
