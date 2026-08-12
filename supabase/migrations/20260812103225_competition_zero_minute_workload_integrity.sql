BEGIN;

DO $$
DECLARE
  v_def text;
  v_old text := 'BEGIN
 v_actions:=';
  v_new text := 'BEGIN
 IF v_minutes<=0 THEN RETURN jsonb_build_object(''label'',''Sem carga'',''intensity'',0,''energy_loss'',0,''fatigue_gain'',0,''recovery_days'',0,''minutes'',0,''physical_actions'',0,''end_match_energy'',NULL);END IF;
 v_actions:=';
BEGIN
  SELECT pg_get_functiondef('private.career_match_load(integer,boolean,jsonb)'::regprocedure)
    INTO v_def;

  IF position(v_old IN v_def) > 0 THEN
    EXECUTE replace(v_def,v_old,v_new);
  ELSIF position('''Sem carga''' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Não foi possível corrigir carga física de jogador sem minutos.';
  END IF;
END $$;

COMMIT;
