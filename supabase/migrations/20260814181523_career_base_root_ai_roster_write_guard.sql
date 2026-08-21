CREATE OR REPLACE FUNCTION private.guard_base_ai_player_sporting_roster()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_level text;
  v_club_level text;
BEGIN
  SELECT squad_level, club_level
    INTO v_level, v_club_level
  FROM public.base_clubs
  WHERE id = NEW.club_id;

  IF v_club_level = 'academy' AND v_level = 'base' THEN
    RAISE EXCEPTION 'A raiz organizacional da base não possui elenco esportivo. Use Sub-15, Sub-17, Sub-18 ou Sub-20.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_base_ai_player_sporting_roster ON public.base_ai_players;
CREATE TRIGGER trg_guard_base_ai_player_sporting_roster
BEFORE INSERT OR UPDATE OF club_id ON public.base_ai_players
FOR EACH ROW
EXECUTE FUNCTION private.guard_base_ai_player_sporting_roster();
