BEGIN;

DO $$
DECLARE
  v_def text;
  v_fixed text;
BEGIN
  SELECT pg_get_functiondef('private.finalize_competition_season(uuid)'::regprocedure)
    INTO v_def;

  v_fixed := replace(v_def, 'SET cash=cash+', 'SET cash_balance=cash_balance+');

  IF v_fixed = v_def AND position('cash_balance=cash_balance+' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Não foi possível alinhar a premiação com cash_balance.';
  END IF;

  IF v_fixed <> v_def THEN
    EXECUTE v_fixed;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
