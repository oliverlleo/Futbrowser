DO $$
DECLARE
  v_def text;
  v_old text := E'  PERFORM private.apply_career_effects(v_player.id, v_effects);';
  v_new text := E'  IF v_session IS NOT NULL THEN\n    v_risk := v_risk\n      + GREATEST(0, 50 - v_state.energy) * 0.45\n      + GREATEST(0, v_state.fatigue - 50) * 0.45;\n  END IF;\n\n  PERFORM private.apply_career_effects(v_player.id, v_effects);';
BEGIN
  SELECT pg_get_functiondef('public.perform_career_activity(text,text,integer)'::regprocedure)
  INTO v_def;

  IF position('GREATEST(0, 50 - v_state.energy) * 0.45' IN v_def) = 0 THEN
    IF position(v_old IN v_def) = 0 THEN
      RAISE EXCEPTION 'Ponto de inserção da correção de risco não encontrado.';
    END IF;
    v_def := replace(v_def, v_old, v_new);
    EXECUTE v_def;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.perform_career_activity(text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_career_activity(text,text,integer) TO authenticated;
