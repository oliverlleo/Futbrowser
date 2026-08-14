ALTER TABLE public.player_sponsor_opportunities ALTER COLUMN status SET DEFAULT 'proposed';

CREATE OR REPLACE FUNCTION private.sponsor_tier_for_player(p_player_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v record;c record;t int:=1;exposure_matches int:=0;historical_tier int:=0;
BEGIN
  SELECT * INTO v FROM public.player_career_state WHERE player_id=p_player_id;
  SELECT * INTO c FROM public.base_clubs WHERE id=v.club_id;
  IF v.player_id IS NULL OR c.id IS NULL THEN RETURN 1; END IF;
  SELECT count(*) INTO exposure_matches
  FROM public.player_match_history h
  WHERE h.player_id=p_player_id
    AND h.match_date BETWEEN v.career_date-90 AND v.career_date
    AND (h.context='national' OR h.metadata ? 'competition_result' OR coalesce(h.rating,0)>=7.5);
  IF c.squad_level IN('base','u15','u17') THEN RETURN 1; END IF;
  IF c.squad_level='u18' THEN
    t:=CASE WHEN coalesce(c.reputation,0)>=4 AND coalesce(v.fame,0)>=30 AND coalesce(v.fanbase,0)>=1200 AND exposure_matches>=1 THEN 2 ELSE 1 END;
  ELSIF c.squad_level='u20' THEN
    t:=CASE WHEN coalesce(c.reputation,0)>=4 AND coalesce(v.fame,0)>=28 AND exposure_matches>=1 THEN 2 ELSE 1 END;
  ELSIF c.squad_level='first_team' THEN
    t:=CASE WHEN coalesce(c.reputation,0)<=3 OR coalesce(c.division_level,4)>=4 THEN 2 WHEN coalesce(c.reputation,0)<=5 OR coalesce(c.division_level,3)=3 THEN 3 ELSE 4 END;
    IF coalesce(v.fame,0)<20 THEN t:=least(t,2); END IF;
    IF coalesce(v.fame,0)<45 OR coalesce(v.fanbase,0)<8000 THEN t:=least(t,3); END IF;
    IF t>=4 AND exposure_matches<2 THEN t:=3; END IF;
    IF coalesce(v.fame,0)>=80 AND coalesce(v.fanbase,0)>=150000 AND coalesce(c.reputation,0)>=8 AND coalesce(c.division_level,1)<=1 AND exposure_matches>=5 THEN t:=5; END IF;
  ELSE
    t:=1;
  END IF;
  SELECT coalesce(max(brand_tier),0) INTO historical_tier FROM (
    SELECT brand_tier FROM public.player_sponsor_contracts WHERE player_id=p_player_id
    UNION ALL
    SELECT brand_tier FROM public.player_sponsor_opportunities WHERE player_id=p_player_id AND status IN('completed','expired','declined')
  ) z;
  IF historical_tier>0 THEN t:=least(t,historical_tier+1); END IF;
  RETURN greatest(1,least(5,t));
END
$function$;

CREATE OR REPLACE FUNCTION private.sponsor_opportunity_terms_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE agent int:=50;penalty_policy jsonb;bonus_policy jsonb;
BEGIN
  penalty_policy:=coalesce(NEW.terms->'penalty_policy',jsonb_build_object(
    'first_miss_percent',25,'repeat_step_percent',25,'max_miss_percent',75,'termination_strikes',3,'termination_trust',30,'termination_fee_rule','half_month_or_two_actions'));
  bonus_policy:=coalesce(NEW.terms->'bonus_policy',jsonb_build_object(
    'appearance',true,'goals',true,'assists',true,'rating_threshold',8,'national_team',true,'title_bonus',true,'multiplier',1.0));
  IF TG_OP='UPDATE' AND NEW.negotiation_round>OLD.negotiation_round THEN
    SELECT coalesce(st.agent_relation,50) INTO agent FROM public.player_career_state st WHERE st.player_id=NEW.player_id;
    NEW.contract_days:=CASE WHEN NEW.offer_kind='main' THEN greatest(60,NEW.contract_days-greatest(5,round(greatest(0,agent-45)/3.0)::int)) ELSE greatest(7,NEW.contract_days-greatest(1,round(greatest(0,agent-50)/15.0)::int)) END;
    IF agent>=62 AND NEW.max_weekly_deliveries>1 THEN NEW.max_weekly_deliveries:=NEW.max_weekly_deliveries-1; END IF;
    IF NEW.exclusivity_category IS NOT NULL AND agent>=68 AND (NEW.negotiation_round>=2 OR random()<.45) THEN NEW.exclusivity_category:=NULL; END IF;
    penalty_policy:=penalty_policy||jsonb_build_object(
      'first_miss_percent',greatest(15,coalesce((penalty_policy->>'first_miss_percent')::int,25)-CASE WHEN agent>=60 THEN 5 ELSE 0 END),
      'repeat_step_percent',greatest(15,coalesce((penalty_policy->>'repeat_step_percent')::int,25)-CASE WHEN agent>=70 THEN 5 ELSE 0 END),
      'max_miss_percent',greatest(50,coalesce((penalty_policy->>'max_miss_percent')::int,75)-CASE WHEN agent>=65 THEN 10 ELSE 0 END),
      'termination_strikes',coalesce((penalty_policy->>'termination_strikes')::int,3)+CASE WHEN agent>=75 AND NEW.offer_kind='main' THEN 1 ELSE 0 END,
      'negotiated_by_agent',true);
    bonus_policy:=bonus_policy||jsonb_build_object('multiplier',round((coalesce((bonus_policy->>'multiplier')::numeric,1.0)+CASE WHEN agent>=60 THEN .08 ELSE .04 END)::numeric,2),'negotiated_by_agent',true);
  END IF;
  NEW.terms:=coalesce(NEW.terms,'{}'::jsonb)||jsonb_build_object(
    'monthly_fee',NEW.monthly_fee,'signing_bonus',NEW.signing_bonus,'per_delivery_fee',NEW.per_delivery_fee,
    'contract_days',NEW.contract_days,'max_weekly_deliveries',NEW.max_weekly_deliveries,
    'exclusivity',NEW.exclusivity_category IS NOT NULL,'category',coalesce(NEW.exclusivity_category,NEW.terms->>'category','general'),
    'brand_tier',NEW.brand_tier,'penalty_policy',penalty_policy,'bonus_policy',bonus_policy);
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS trg_sponsor_opportunity_terms_guard ON public.player_sponsor_opportunities;
CREATE TRIGGER trg_sponsor_opportunity_terms_guard BEFORE INSERT OR UPDATE ON public.player_sponsor_opportunities FOR EACH ROW EXECUTE FUNCTION private.sponsor_opportunity_terms_guard();

CREATE OR REPLACE FUNCTION private.sponsor_contract_terms_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE t jsonb;
BEGIN
  IF NEW.proposal_id IS NOT NULL THEN
    SELECT terms INTO t FROM public.player_sponsor_opportunities WHERE id=NEW.proposal_id;
    NEW.metadata:=coalesce(NEW.metadata,'{}'::jsonb)||jsonb_build_object(
      'accepted_terms',coalesce(t,'{}'::jsonb),'penalty_policy',coalesce(t->'penalty_policy','{}'::jsonb),'bonus_policy',coalesce(t->'bonus_policy','{}'::jsonb));
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS trg_sponsor_contract_terms_guard ON public.player_sponsor_contracts;
CREATE TRIGGER trg_sponsor_contract_terms_guard BEFORE INSERT ON public.player_sponsor_contracts FOR EACH ROW EXECUTE FUNCTION private.sponsor_contract_terms_guard();

UPDATE public.player_sponsor_opportunities SET terms=coalesce(terms,'{}'::jsonb) WHERE status='proposed';
