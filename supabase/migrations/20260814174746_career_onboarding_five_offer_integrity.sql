CREATE OR REPLACE FUNCTION public.generate_initial_offers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid:=auth.uid();v_player_id uuid;v_age int;v_club record;v_context jsonb;v_terms jsonb;v_target text;v_active int:=0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado';END IF;
  SELECT j.id,j.idade INTO v_player_id,v_age FROM public.jogadores j WHERE j.user_id=v_user_id;
  IF v_player_id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado';END IF;
  IF EXISTS(SELECT 1 FROM public.player_contracts pc WHERE pc.player_id=v_player_id AND pc.status='active') THEN RETURN;END IF;

  SELECT count(*) INTO v_active FROM public.player_offers
  WHERE player_id=v_player_id AND offer_type='initial' AND status IN('new','reviewed','negotiating','countered');
  IF v_active>0 THEN RETURN;END IF;

  v_target:=private.career_youth_squad_for_age(v_age);

  FOR v_club IN
    SELECT ranked.*
    FROM (
      SELECT c.*,ctx.context_data,
             coalesce((ctx.context_data->'compatibility_breakdown'->>'compatibility_total')::int,0) compatibility_score
      FROM public.base_clubs c
      CROSS JOIN LATERAL (SELECT private.build_offer_context(v_player_id,c.id) context_data) ctx
      WHERE c.is_active AND c.club_level='academy' AND c.squad_level='base'
    ) ranked
    ORDER BY ranked.compatibility_score DESC,ranked.reputation DESC,ranked.name
    LIMIT 5
  LOOP
    v_context:=v_club.context_data;
    v_terms:=(CASE WHEN coalesce(v_club.reputation,3)>=5 THEN jsonb_build_object('squad_role','Promessa','monthly_wage',1600,'signing_bonus',4000,'release_clause',1000000,'duration_seasons',3,'contract_scope','academy_base') WHEN coalesce(v_club.reputation,3)=4 THEN jsonb_build_object('squad_role','Reserva','monthly_wage',1800,'signing_bonus',3000,'release_clause',600000,'duration_seasons',2,'contract_scope','academy_base') WHEN coalesce(v_club.reputation,3)=3 THEN jsonb_build_object('squad_role','Rotação','monthly_wage',1500,'signing_bonus',2250,'release_clause',475000,'duration_seasons',2,'contract_scope','academy_base') ELSE jsonb_build_object('squad_role','Titular','monthly_wage',1250,'signing_bonus',1000,'release_clause',250000,'duration_seasons',2,'contract_scope','academy_base') END)||coalesce(v_club.base_terms,'{}'::jsonb)||jsonb_build_object('target_squad_level',v_target);
    INSERT INTO public.player_offers(player_id,club_id,initial_terms,current_terms,status,internal_tolerance,compatibility_breakdown,snapshot_data,is_emergency,offer_type,target_squad_level)
    VALUES(v_player_id,v_club.id,v_terms,v_terms,'new',(v_context->>'internal_tolerance')::int,v_context->'compatibility_breakdown',v_context->'snapshot_data',false,'initial',v_target);
  END LOOP;
END
$function$;

CREATE OR REPLACE FUNCTION public.get_career_onboarding_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid:=auth.uid();v_player_count int:=0;v_player_id uuid;v_has_player boolean:=false;v_offers_generated boolean:=false;v_active_offers int:=0;v_contract_signed boolean:=false;v_onboarding_completed boolean:=false;v_generated_offer_clubs int:=0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado';END IF;
  SELECT count(*) INTO v_player_count FROM public.jogadores WHERE user_id=v_user_id;
  IF v_player_count>1 THEN RAISE EXCEPTION 'Duplicidade de jogador detectada para este usuário.';ELSIF v_player_count=1 THEN v_has_player:=true;SELECT j.id INTO v_player_id FROM public.jogadores j WHERE j.user_id=v_user_id;END IF;
  IF v_has_player THEN
    SELECT count(*) INTO v_active_offers FROM public.player_offers WHERE player_id=v_player_id AND offer_type='initial' AND status IN('new','reviewed','negotiating','countered');
    SELECT count(distinct po.club_id) INTO v_generated_offer_clubs FROM public.player_offers po JOIN public.base_clubs c ON c.id=po.club_id WHERE po.player_id=v_player_id AND po.offer_type='initial' AND po.status IN('new','reviewed','negotiating','countered') AND c.club_level='academy' AND c.squad_level='base';
    SELECT EXISTS(SELECT 1 FROM public.player_contracts WHERE player_id=v_player_id AND status='active') INTO v_contract_signed;
    SELECT coalesce(pcs.onboarding_completed,false) INTO v_onboarding_completed FROM public.player_career_state pcs WHERE pcs.player_id=v_player_id;
    v_onboarding_completed:=coalesce(v_onboarding_completed,false);
    v_offers_generated:=v_contract_signed OR v_onboarding_completed OR v_active_offers>0;
  END IF;
  RETURN jsonb_build_object('has_player',v_has_player,'offers_generated',v_offers_generated,'generated_offer_clubs',v_generated_offer_clubs,'expected_offer_clubs',5,'active_offers',v_active_offers,'contract_signed',v_contract_signed,'onboarding_completed',v_onboarding_completed);
END
$function$;

WITH ranked AS(
  SELECT po.id,po.player_id,row_number() OVER(PARTITION BY po.player_id ORDER BY coalesce((po.compatibility_breakdown->>'compatibility_total')::numeric,(po.compatibility_breakdown->>'total')::numeric,0) DESC,c.reputation DESC,po.created_at,po.id) rn
  FROM public.player_offers po
  JOIN public.base_clubs c ON c.id=po.club_id
  LEFT JOIN public.player_contracts pc ON pc.player_id=po.player_id AND pc.status='active'
  WHERE po.offer_type='initial' AND po.status IN('new','reviewed','negotiating','countered') AND pc.id IS NULL
)
UPDATE public.player_offers po SET status='withdrawn'
FROM ranked r WHERE po.id=r.id AND r.rn>5;
