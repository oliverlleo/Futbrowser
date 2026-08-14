WITH corrected AS (
  SELECT r.id, private.career_promotion_snapshot(r.player_id) AS snap
  FROM public.player_promotion_reviews r
  JOIN public.player_career_state st
    ON st.player_id=r.player_id
   AND st.career_date=r.reviewed_on
  JOIN public.base_clubs c ON c.id=st.club_id
  WHERE r.from_squad='base'
    AND c.squad_level IN('u15','u17','u18','u20')
)
UPDATE public.player_promotion_reviews r
SET from_squad=corrected.snap->>'current_squad',
    recommended_squad=corrected.snap->>'recommended_squad',
    score=coalesce((corrected.snap->>'score')::int,r.score),
    outcome='stay',
    snapshot=corrected.snap
FROM corrected
WHERE r.id=corrected.id
  AND coalesce((corrected.snap->>'eligible')::boolean,false)=false
  AND corrected.snap->>'current_squad' IN('u15','u17','u18','u20','first_team');

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.player_promotion_reviews WHERE from_squad='base' OR recommended_squad='base') THEN
    RAISE EXCEPTION 'Existem revisões de promoção legadas sem reconstrução esportiva segura.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.player_squad_assignments WHERE squad_level='base') THEN
    RAISE EXCEPTION 'Existem atribuições esportivas legadas na raiz base.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.player_offers WHERE target_squad_level='base') THEN
    RAISE EXCEPTION 'Existem ofertas com destino esportivo base.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.player_transfer_bids WHERE target_squad_level='base') THEN
    RAISE EXCEPTION 'Existem bids com destino esportivo base.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.player_transfer_agreements WHERE target_squad_level='base') THEN
    RAISE EXCEPTION 'Existem acordos com destino esportivo base.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.player_market_interests WHERE target_squad_level='base') THEN
    RAISE EXCEPTION 'Existem interesses com destino esportivo base.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.competition_definitions WHERE age_level='base') THEN
    RAISE EXCEPTION 'Existe competição usando base como categoria.';
  END IF;
END
$$;

ALTER TABLE public.player_squad_assignments
  DROP CONSTRAINT IF EXISTS player_squad_assignments_squad_level_check;
ALTER TABLE public.player_squad_assignments
  ADD CONSTRAINT player_squad_assignments_squad_level_check
  CHECK(squad_level IN('u15','u17','u18','u20','first_team'));

ALTER TABLE public.player_offers
  DROP CONSTRAINT IF EXISTS player_offers_target_squad_check;
ALTER TABLE public.player_offers
  ADD CONSTRAINT player_offers_target_squad_check
  CHECK(target_squad_level IS NULL OR target_squad_level IN('u15','u17','u18','u20','first_team'));

ALTER TABLE public.player_transfer_bids
  DROP CONSTRAINT IF EXISTS player_transfer_bids_target_squad_level_check;
ALTER TABLE public.player_transfer_bids
  ADD CONSTRAINT player_transfer_bids_target_squad_level_check
  CHECK(target_squad_level IN('u15','u17','u18','u20','first_team'));

ALTER TABLE public.player_transfer_agreements
  DROP CONSTRAINT IF EXISTS player_transfer_agreements_target_squad_level_check;
ALTER TABLE public.player_transfer_agreements
  ADD CONSTRAINT player_transfer_agreements_target_squad_level_check
  CHECK(target_squad_level IN('u15','u17','u18','u20','first_team'));

ALTER TABLE public.player_market_interests
  DROP CONSTRAINT IF EXISTS player_market_interests_target_squad_level_check;
ALTER TABLE public.player_market_interests
  ADD CONSTRAINT player_market_interests_target_squad_level_check
  CHECK(target_squad_level IN('u15','u17','u18','u20','first_team'));

ALTER TABLE public.player_promotion_reviews
  DROP CONSTRAINT IF EXISTS player_promotion_reviews_from_squad_check;
ALTER TABLE public.player_promotion_reviews
  ADD CONSTRAINT player_promotion_reviews_from_squad_check
  CHECK(from_squad IS NULL OR from_squad IN('u15','u17','u18','u20','first_team'));

ALTER TABLE public.player_promotion_reviews
  DROP CONSTRAINT IF EXISTS player_promotion_reviews_recommended_squad_check;
ALTER TABLE public.player_promotion_reviews
  ADD CONSTRAINT player_promotion_reviews_recommended_squad_check
  CHECK(recommended_squad IS NULL OR recommended_squad IN('u15','u17','u18','u20','first_team'));

ALTER TABLE public.competition_definitions
  DROP CONSTRAINT IF EXISTS competition_definitions_age_level_check;
ALTER TABLE public.competition_definitions
  ADD CONSTRAINT competition_definitions_age_level_check
  CHECK(age_level IS NULL OR age_level IN('u15','u17','u18','u20'));