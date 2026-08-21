ALTER TABLE public.player_offers ADD COLUMN IF NOT EXISTS career_expires_on date;

CREATE OR REPLACE FUNCTION private.set_career_offer_expiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_date date;
BEGIN
 IF new.offer_type<>'initial' AND new.career_expires_on IS NULL THEN
   SELECT career_date INTO v_date FROM public.player_career_state WHERE player_id=new.player_id;
   new.career_expires_on:=COALESCE(v_date,current_date)+CASE WHEN new.offer_type='professional_promotion' THEN 14 ELSE 12 END;
 END IF;
 RETURN new;
END $$;

DROP TRIGGER IF EXISTS trg_set_career_offer_expiry ON public.player_offers;
CREATE TRIGGER trg_set_career_offer_expiry BEFORE INSERT ON public.player_offers FOR EACH ROW EXECUTE FUNCTION private.set_career_offer_expiry();

UPDATE public.player_offers po
SET career_expires_on=st.career_date+CASE WHEN po.offer_type='professional_promotion' THEN 14 ELSE 12 END
FROM public.player_career_state st
WHERE st.player_id=po.player_id AND po.offer_type<>'initial' AND po.career_expires_on IS NULL AND po.status IN('new','reviewed','negotiating','countered');

CREATE OR REPLACE FUNCTION public.review_career_offer_expiry()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_player uuid;v_date date;v_count int;
BEGIN
 SELECT j.id,st.career_date INTO v_player,v_date FROM public.jogadores j JOIN public.player_career_state st ON st.player_id=j.id WHERE j.user_id=auth.uid();
 IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;
 UPDATE public.player_offers SET status='expired' WHERE player_id=v_player AND offer_type<>'initial' AND status IN('new','reviewed','negotiating','countered') AND career_expires_on<v_date;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.review_career_offer_expiry() TO authenticated;
