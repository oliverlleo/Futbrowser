CREATE OR REPLACE FUNCTION private.normalize_career_offer_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_date date;
BEGIN
  IF new.offer_type='initial' THEN RETURN new; END IF;
  SELECT career_date INTO v_date FROM public.player_career_state WHERE player_id=new.player_id;

  IF new.offer_type IN('academy_transfer','professional_promotion') THEN
    new.effective_on:=COALESCE(v_date,current_date);
    new.window_code:=CASE WHEN new.offer_type='professional_promotion' THEN 'INTERNAL' ELSE 'YOUTH' END;
  ELSIF new.offer_type='professional_transfer' THEN
    new.effective_on:=private.career_next_registration_date(COALESCE(v_date,current_date));
    new.window_code:=COALESCE((private.career_transfer_window_status(COALESCE(v_date,current_date)))->>'code','CLOSED');
  END IF;

  RETURN new;
END $$;

DROP TRIGGER IF EXISTS trg_normalize_career_offer_registration ON public.player_offers;
CREATE TRIGGER trg_normalize_career_offer_registration
BEFORE INSERT ON public.player_offers
FOR EACH ROW EXECUTE FUNCTION private.normalize_career_offer_registration();
