BEGIN;

DO $$
DECLARE
  v_def text;
  v_old text := 'v_start:=v_state.career_date+28;';
  v_new text := 'v_start:=greatest(v_state.career_date+28,make_date(v_year+1,1,15));';
BEGIN
  SELECT pg_get_functiondef('private.roll_competition_world_if_needed(uuid)'::regprocedure)
    INTO v_def;

  IF position(v_old IN v_def) > 0 THEN
    EXECUTE replace(v_def, v_old, v_new);
  ELSIF position('make_date(v_year+1,1,15)' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Não foi possível alinhar a próxima temporada ao ano-calendário.';
  END IF;
END $$;

COMMIT;
