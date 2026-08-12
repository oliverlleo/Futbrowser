BEGIN;

DO $$
DECLARE
  v_def text;
  v_old text := 'FOR v_club IN SELECT * FROM public.base_clubs LOOP';
  v_new text := 'FOR v_club IN SELECT * FROM public.base_clubs WHERE is_active AND club_level=''academy'' LOOP';
BEGIN
  SELECT pg_get_functiondef('public.generate_initial_offers()'::regprocedure)
    INTO v_def;

  IF position(v_old IN v_def) > 0 THEN
    EXECUTE replace(v_def, v_old, v_new);
  ELSIF position('club_level=''academy''' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Não foi possível proteger as ofertas iniciais contra clubes profissionais.';
  END IF;
END $$;

COMMIT;
