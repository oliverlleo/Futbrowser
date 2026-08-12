BEGIN;

CREATE OR REPLACE FUNCTION public.sync_offer_flexibility_from_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.player_offers
  SET internal_tolerance = GREATEST(0, COALESCE(NEW.remaining_flexibility, 0))
  WHERE id = NEW.offer_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_offer_flexibility_from_history() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_offer_flexibility ON public.player_offer_history;
CREATE TRIGGER trg_sync_offer_flexibility
AFTER INSERT ON public.player_offer_history
FOR EACH ROW
EXECUTE FUNCTION public.sync_offer_flexibility_from_history();

WITH latest AS (
  SELECT DISTINCT ON (offer_id)
    offer_id,
    remaining_flexibility
  FROM public.player_offer_history
  ORDER BY offer_id, round DESC, created_at DESC
)
UPDATE public.player_offers po
SET internal_tolerance = GREATEST(0, COALESCE(latest.remaining_flexibility, 0))
FROM latest
WHERE po.id = latest.offer_id;

COMMIT;
